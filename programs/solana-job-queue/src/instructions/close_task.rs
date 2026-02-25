use anchor_lang::prelude::*;

use crate::errors::QueueError;
use crate::state::{Queue, Task, TaskStatus};

/// Closes a completed or failed task account, reclaiming the rent to the authority.
///
/// # Web2 Equivalent
/// - Redis: `DEL key` — remove processed messages from memory
/// - RabbitMQ: Auto-ack deletes messages from the queue storage
/// - SQS: `sqs.delete_message()` — remove from queue after processing
/// - Database: `DELETE FROM jobs WHERE status IN ('completed', 'failed') AND age > retention`
///
/// # On-chain Design
/// On Solana, each account requires rent (a SOL deposit proportional to data size).
/// Closing task accounts after processing reclaims this rent, making the system
/// economically efficient. This is a key difference from Web2 where storage cleanup
/// is about disk space rather than locked capital.
///
/// Only the queue authority can close tasks, providing administrative control
/// over data retention.
pub fn handler(_ctx: Context<CloseTask>) -> Result<()> {
    // The close constraint in the Account validation handles the actual closing.
    // We just need to validate that the task is in a terminal state.
    msg!("Task account closed, rent reclaimed");
    Ok(())
}

#[derive(Accounts)]
pub struct CloseTask<'info> {
    #[account(
        mut,
        close = authority,
        constraint = task.queue == queue.key() @ QueueError::TaskQueueMismatch,
        constraint = (task.status == TaskStatus::Completed || task.status == TaskStatus::Failed) @ QueueError::TaskNotFinished,
    )]
    pub task: Account<'info, Task>,

    #[account(
        has_one = authority,
    )]
    pub queue: Account<'info, Queue>,

    /// The queue authority who receives the reclaimed rent.
    #[account(mut)]
    pub authority: Signer<'info>,
}
