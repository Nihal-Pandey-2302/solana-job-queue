use anchor_lang::prelude::*;

use crate::errors::QueueError;
use crate::state::{Queue, Task, TaskStatus, Worker};

/// A worker claims (dequeues) a pending task for processing.
///
/// # Web2 Equivalent
/// This is the "consumer" side of the job queue:
/// - Redis: `BRPOPLPUSH source destination` (atomic pop + push to processing list)
/// - RabbitMQ: `channel.basic_get(queue)` with manual ack
/// - SQS: `sqs.receive_message(QueueUrl)` (message becomes invisible)
/// - Celery: Worker's prefetch mechanism
///
/// # On-chain Design
/// Unlike Web2 where the broker manages visibility/locks, Solana's runtime
/// ensures atomicity: if two workers try to process the same task in the same
/// slot, only one transaction will succeed (the other will fail due to account
/// write locks). This is **free concurrency control** provided by the runtime.
///
/// The worker must be registered and active. The task must be in `Pending` status
/// and, if scheduled, the `execute_after` timestamp must be in the past.
///
/// # State Transition
/// `Pending` → `Processing`
pub fn handler(ctx: Context<ProcessTask>) -> Result<()> {
    let task = &mut ctx.accounts.task;
    let worker = &ctx.accounts.worker;
    let queue = &mut ctx.accounts.queue;

    // Validate worker state
    require!(worker.is_active, QueueError::WorkerNotActive);
    require!(worker.queue == queue.key(), QueueError::WorkerQueueMismatch);

    // Validate task state
    require!(task.status == TaskStatus::Pending, QueueError::TaskNotPending);
    require!(task.queue == queue.key(), QueueError::TaskQueueMismatch);

    // Check scheduled execution time
    let now = Clock::get()?.unix_timestamp;
    if task.execute_after > 0 {
        require!(now >= task.execute_after, QueueError::TaskNotYetScheduled);
    }

    // State transition: Pending → Processing
    task.status = TaskStatus::Processing;
    task.worker = ctx.accounts.authority.key();
    task.started_at = now;

    // Update queue counters
    queue.pending_count = queue.pending_count.checked_sub(1).unwrap();
    queue.processing_count = queue.processing_count.checked_add(1).unwrap();

    msg!(
        "Task #{} claimed by worker {}",
        task.task_id,
        task.worker
    );
    Ok(())
}

#[derive(Accounts)]
pub struct ProcessTask<'info> {
    #[account(mut)]
    pub task: Account<'info, Task>,

    #[account(mut)]
    pub queue: Account<'info, Queue>,

    #[account(
        seeds = [b"worker", queue.key().as_ref(), authority.key().as_ref()],
        bump = worker.bump,
        has_one = authority,
    )]
    pub worker: Account<'info, Worker>,

    pub authority: Signer<'info>,
}
