use anchor_lang::prelude::*;
use crate::errors::QueueError;

/// Represents the status of a task in the queue.
/// Models a deterministic state machine with well-defined transitions:
///   Pending → Processing → Completed
///                        → Failed → Pending (if retries remain)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum TaskStatus {
    /// Task is waiting to be picked up by a worker.
    Pending,
    /// Task has been claimed by a worker and is currently executing.
    Processing,
    /// Task has been successfully completed with a result.
    Completed,
    /// Task has failed. May be re-queued if retries remain.
    Failed,
}

impl Default for TaskStatus {
    fn default() -> Self {
        TaskStatus::Pending
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, Default, InitSpace)]
pub struct HeapItem {
    pub task_id: u64,
    pub priority: u8,
}

/// A multi-tenant task queue — the top-level organizational unit.
///
/// Each queue is owned by an `authority` and identified by a human-readable `name`.
/// PDA seeds: `[b"queue", authority.key(), name.as_bytes()]`
#[account]
#[derive(InitSpace)]
pub struct Queue {
    /// The wallet that created and owns this queue.
    pub authority: Pubkey,

    /// Human-readable name for the queue (max 32 bytes).
    #[max_len(32)]
    pub name: String,

    /// Auto-incrementing counter used to assign sequential task IDs.
    pub total_tasks: u64,

    /// Number of tasks currently in `Pending` status.
    pub pending_count: u64,

    /// Number of tasks currently in `Processing` status.
    pub processing_count: u64,

    /// Number of tasks in `Completed` status.
    pub completed_count: u64,

    /// Number of tasks in `Failed` status (after all retries exhausted).
    pub failed_count: u64,

    /// Default maximum retry attempts for tasks in this queue.
    pub max_retries: u8,

    /// Unix timestamp when this queue was created.
    pub created_at: i64,

    /// PDA bump seed.
    pub bump: u8,

    /// On-chain priority max-heap for O(log n) task processing order
    pub priority_heap: [HeapItem; 64],
    
    /// Current number of items in the heap
    pub heap_size: u16,

    /// Whether rate limiting is enabled for this queue
    pub rate_limit_enabled: bool,

    /// Maximum number of tasks allowed per time window
    pub max_tasks_per_window: u32,

    /// Duration of the sliding window in seconds
    pub window_duration_seconds: i64,

    /// Unix timestamp when the current rate limit window started
    pub current_window_start: i64,

    /// Number of tasks enqueued in the current window
    pub current_window_count: u32,

    /// Whether the queue is currently paused (circuit breaker)
    pub is_paused: bool,

    /// Unix timestamp when the queue was paused
    pub paused_at: i64,

    /// Reason for the pause (max 64 chars)
    #[max_len(64)]
    pub pause_reason: String,
}

impl Queue {
    pub fn push(&mut self, item: HeapItem) -> Result<()> {
        if self.heap_size as usize >= 64 {
            // Technically we should throw an error, but if the heap is full we can just 
            // process normally (fallback to linear) or return an error. Let's return error.
            return err!(QueueError::QueueCapacityExceeded);
        }
        let mut i = self.heap_size as usize;
        self.priority_heap[i] = item;
        self.heap_size += 1;
        
        // Bubble up
        while i > 0 {
            let parent = (i - 1) / 2;
            if self.priority_heap[i].priority > self.priority_heap[parent].priority {
                self.priority_heap.swap(i, parent);
                i = parent;
            } else {
                break;
            }
        }
        Ok(())
    }

    pub fn remove_task(&mut self, task_id: u64) {
        if self.heap_size == 0 {
            return;
        }
        
        let mut index = None;
        for i in 0..self.heap_size as usize {
            if self.priority_heap[i].task_id == task_id {
                index = Some(i);
                break;
            }
        }
        
        if let Some(i) = index {
            self.heap_size -= 1;
            if i < self.heap_size as usize {
                self.priority_heap[i] = self.priority_heap[self.heap_size as usize];
                
                let mut current = i;
                let mut bubbled_up = false;
                
                while current > 0 {
                    let parent = (current - 1) / 2;
                    if self.priority_heap[current].priority > self.priority_heap[parent].priority {
                        self.priority_heap.swap(current, parent);
                        current = parent;
                        bubbled_up = true;
                    } else {
                        break;
                    }
                }
                
                if !bubbled_up {
                    loop {
                        let left = 2 * current + 1;
                        let right = 2 * current + 2;
                        let mut largest = current;
                        
                        if left < self.heap_size as usize && self.priority_heap[left].priority > self.priority_heap[largest].priority {
                            largest = left;
                        }
                        if right < self.heap_size as usize && self.priority_heap[right].priority > self.priority_heap[largest].priority {
                            largest = right;
                        }
                        
                        if largest != current {
                            self.priority_heap.swap(current, largest);
                            current = largest;
                        } else {
                            break;
                        }
                    }
                }
            }
            self.priority_heap[self.heap_size as usize] = HeapItem::default();
        }
    }
}

/// A single task within a queue — the core work unit.
///
/// Models a unit of work with payload, priority, scheduling, and lifecycle tracking.
/// PDA seeds: `[b"task", queue.key(), &task_id.to_le_bytes()]`
#[account]
#[derive(InitSpace)]
pub struct Task {
    /// The parent queue this task belongs to.
    pub queue: Pubkey,

    /// Sequential task ID within the queue.
    pub task_id: u64,

    /// The wallet that enqueued this task (producer).
    pub creator: Pubkey,

    /// The worker currently processing this task (if any).
    pub worker: Pubkey,

    /// Current lifecycle status of the task.
    pub status: TaskStatus,

    /// Priority level (0-255). Higher values = higher priority.
    /// Workers should process higher-priority tasks first.
    pub priority: u8,

    /// Task payload — typically a JSON-encoded work description.
    #[max_len(512)]
    pub payload: String,

    /// Result data — populated when the task is completed.
    #[max_len(512)]
    pub result: String,

    /// How many times this task has been retried after failure.
    pub retry_count: u8,

    /// Maximum number of retries allowed for this task.
    pub max_retries: u8,

    /// Optional: earliest Unix timestamp at which this task should be processed.
    /// Workers should skip tasks where `execute_after > current_time`.
    pub execute_after: i64,

    /// Optional: task_id of a prerequisite task that must be Completed first.
    pub depends_on: Option<u64>,

    /// Unix timestamp when the task was enqueued.
    pub created_at: i64,

    /// Unix timestamp when a worker started processing (0 if not yet started).
    pub started_at: i64,

    /// Unix timestamp when the task was completed or permanently failed (0 if not yet).
    pub completed_at: i64,

    /// PDA bump seed.
    pub bump: u8,
}

/// A registered worker for a specific queue.
///
/// Workers must register before they can process tasks.
/// PDA seeds: `[b"worker", queue.key(), authority.key()]`
#[account]
#[derive(InitSpace)]
pub struct Worker {
    /// The queue this worker is registered with.
    pub queue: Pubkey,

    /// The wallet that controls this worker.
    pub authority: Pubkey,

    /// Lifetime count of tasks successfully completed by this worker.
    pub tasks_completed: u64,

    /// Lifetime count of tasks failed by this worker.
    pub tasks_failed: u64,

    /// Whether this worker is currently active and can accept tasks.
    pub is_active: bool,

    /// Unix timestamp when this worker registered.
    pub registered_at: i64,

    /// PDA bump seed.
    pub bump: u8,
}
