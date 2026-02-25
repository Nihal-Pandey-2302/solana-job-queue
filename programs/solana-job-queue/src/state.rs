use anchor_lang::prelude::*;

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
