use anchor_lang::prelude::*;

use crate::errors::QueueError;
use crate::events::*;
use crate::state::{Queue, Task, TaskStatus, Worker};

/// A worker marks a task as successfully completed with a result.
///
/// # Web2 Equivalent
/// - Redis: Remove from processing list, store result in result backend
/// - RabbitMQ: `channel.basic_ack(delivery_tag)` — acknowledge message
/// - SQS: `sqs.delete_message(QueueUrl, ReceiptHandle)` — remove from queue
/// - Celery: `AsyncResult.get()` returns the result to the caller
///
/// # On-chain Design
/// The result is stored directly in the task PDA account, making it permanently
/// available on-chain. This is analogous to Celery's result backend but with
/// the added benefit of immutability and public verifiability.
///
/// # State Transition
/// `Processing` → `Completed`
pub fn handler(ctx: Context<CompleteTask>, result: String) -> Result<()> {
    require!(result.len() <= 512, QueueError::ResultTooLong);

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

    // State transition: Processing → Completed
    task.status = TaskStatus::Completed;
    task.result = result;
    task.completed_at = Clock::get()?.unix_timestamp;

    // Update counters
    queue.processing_count = queue.processing_count.checked_sub(1).unwrap();
    queue.completed_count = queue.completed_count.checked_add(1).unwrap();

    // Update worker stats
    worker.tasks_completed = worker.tasks_completed.checked_add(1).unwrap();

    let duration_seconds = task.completed_at - task.started_at;
    emit!(TaskCompleted {
        queue: queue.key(),
        task_id: task.task_id,
        worker: task.worker,
        duration_seconds,
        retry_count: task.retry_count,
    });

    emit!(QueueMetricsSnapshot {
        queue: queue.key(),
        total_tasks: queue.total_tasks,
        pending: queue.pending_count,
        processing: queue.processing_count,
        completed: queue.completed_count,
        failed: queue.failed_count,
    });

    msg!("Task #{} completed successfully", task.task_id);
    Ok(())
}

#[derive(Accounts)]
pub struct CompleteTask<'info> {
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
