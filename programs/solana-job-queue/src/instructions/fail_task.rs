use anchor_lang::prelude::*;

use crate::errors::QueueError;
use crate::state::{Queue, Task, TaskStatus, Worker};

/// A worker reports that a task has failed.
///
/// If the task has remaining retries, it is automatically re-queued (set back to
/// `Pending` status). Otherwise, it is permanently marked as `Failed`.
///
/// # Web2 Equivalent
/// - Redis/Celery: Task is moved to a dead letter queue or retried with exponential backoff
/// - RabbitMQ: `channel.basic_nack(delivery_tag, requeue=True)` for retry,
///   or routed to a Dead Letter Exchange (DLX) when retries exhausted
/// - SQS: Message reappears after visibility timeout, or moves to DLQ after maxReceiveCount
///
/// # On-chain Design
/// The retry mechanism is implemented as a state transition back to `Pending`,
/// with a `retry_count` counter to track attempts. This is simpler than Web2
/// exponential backoff but achieves the same purpose: giving tasks multiple
/// chances to succeed.
///
/// When retries are exhausted, the task remains in `Failed` state — analogous
/// to a Dead Letter Queue (DLQ). The queue authority can inspect failed tasks
/// and close them to reclaim rent.
///
/// # State Transitions
/// - `Processing` → `Pending` (if retries remain — automatic re-queue)
/// - `Processing` → `Failed` (if retries exhausted — dead letter)
pub fn handler(ctx: Context<FailTask>) -> Result<()> {
    let task = &mut ctx.accounts.task;
    let worker = &mut ctx.accounts.worker;
    let queue = &mut ctx.accounts.queue;

    // Validate state
    require!(
        task.status == TaskStatus::Processing,
        QueueError::TaskNotProcessing
    );
    require!(
        task.worker == ctx.accounts.authority.key(),
        QueueError::UnauthorizedWorker
    );

    // Decrement processing count
    queue.processing_count = queue.processing_count.checked_sub(1).unwrap();

    // Update worker failure stats
    worker.tasks_failed = worker.tasks_failed.checked_add(1).unwrap();

    // Check if retries remain
    task.retry_count = task.retry_count.checked_add(1).unwrap();

    if task.retry_count < task.max_retries {
        // Re-queue: Processing → Pending
        task.status = TaskStatus::Pending;
        task.worker = Pubkey::default();
        task.started_at = 0;
        queue.pending_count = queue.pending_count.checked_add(1).unwrap();

        msg!(
            "Task #{} failed (attempt {}/{}), re-queued",
            task.task_id,
            task.retry_count,
            task.max_retries
        );
    } else {
        // Dead letter: Processing → Failed
        task.status = TaskStatus::Failed;
        task.completed_at = Clock::get()?.unix_timestamp;
        queue.failed_count = queue.failed_count.checked_add(1).unwrap();

        msg!(
            "Task #{} permanently failed after {} attempts",
            task.task_id,
            task.retry_count
        );
    }

    Ok(())
}

#[derive(Accounts)]
pub struct FailTask<'info> {
    #[account(mut)]
    pub task: Account<'info, Task>,

    #[account(mut)]
    pub queue: Account<'info, Queue>,

    #[account(
        mut,
        seeds = [b"worker", queue.key().as_ref(), authority.key().as_ref()],
        bump = worker.bump,
        has_one = authority,
    )]
    pub worker: Account<'info, Worker>,

    pub authority: Signer<'info>,
}
