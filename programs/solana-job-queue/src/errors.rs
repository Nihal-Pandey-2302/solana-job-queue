use anchor_lang::prelude::*;

/// Custom error types for the Solana Job Queue program.
///
/// Each error maps to a specific violation of the state machine invariants
/// or access control rules, providing clear diagnostics for clients.
#[error_code]
pub enum QueueError {
    /// The queue name exceeds the maximum allowed length of 32 characters.
    #[msg("Queue name must be 32 characters or fewer")]
    QueueNameTooLong,

    /// The task payload exceeds the maximum allowed length of 512 bytes.
    #[msg("Task payload must be 512 bytes or fewer")]
    PayloadTooLong,

    /// The task result exceeds the maximum allowed length of 512 bytes.
    #[msg("Task result must be 512 bytes or fewer")]
    ResultTooLong,

    /// Attempted to process a task that is not in the `Pending` state.
    #[msg("Task is not in Pending status")]
    TaskNotPending,

    /// Attempted to complete or fail a task that is not in the `Processing` state.
    #[msg("Task is not in Processing status")]
    TaskNotProcessing,

    /// The signing worker is not the one assigned to this task.
    #[msg("Only the assigned worker can complete or fail this task")]
    UnauthorizedWorker,

    /// The worker account is not marked as active.
    #[msg("Worker is not active")]
    WorkerNotActive,

    /// The task has exhausted all retry attempts and cannot be re-queued.
    #[msg("Task has exceeded maximum retry attempts")]
    MaxRetriesExceeded,

    /// The task cannot be closed because it is still pending or processing.
    #[msg("Only completed or failed tasks can be closed")]
    TaskNotFinished,

    /// The task's `execute_after` timestamp is in the future.
    #[msg("Task is scheduled for future execution and cannot be processed yet")]
    TaskNotYetScheduled,

    /// Priority value must be between 0 and 255.
    #[msg("Invalid priority value")]
    InvalidPriority,

    /// The task does not belong to the specified queue.
    #[msg("Task does not belong to this queue")]
    TaskQueueMismatch,

    /// The worker does not belong to the specified queue.
    #[msg("Worker does not belong to this queue")]
    WorkerQueueMismatch,
}
