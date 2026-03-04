use anchor_lang::prelude::*;

#[event]
pub struct TaskEnqueued {
    pub queue: Pubkey,
    pub task_id: u64,
    pub priority: u8,
    pub execute_after: i64,
    #[index]
    pub authority: Pubkey,
}

#[event]
pub struct TaskProcessed {
    pub queue: Pubkey,
    pub task_id: u64,
    #[index]
    pub worker: Pubkey,
    pub claimed_at: i64,
}

#[event]
pub struct TaskCompleted {
    pub queue: Pubkey,
    pub task_id: u64,
    pub worker: Pubkey,
    pub duration_seconds: i64,
    pub retry_count: u8,
}

#[event]
pub struct TaskFailed {
    pub queue: Pubkey,
    pub task_id: u64,
    pub worker: Pubkey,
    pub retry_count: u8,
    pub is_dead_letter: bool,
}

#[event]
pub struct QueueMetricsSnapshot {
    pub queue: Pubkey,
    pub total_tasks: u64,
    pub pending: u64,
    pub processing: u64,
    pub completed: u64,
    pub failed: u64,
}

#[event]
pub struct QueuePausedEvent {
    pub queue: Pubkey,
    pub reason: String,
    pub authority: Pubkey,
}

#[event]
pub struct QueueResumedEvent {
    pub queue: Pubkey,
    pub authority: Pubkey,
}
