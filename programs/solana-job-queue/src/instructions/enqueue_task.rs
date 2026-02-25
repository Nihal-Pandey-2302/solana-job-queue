use anchor_lang::prelude::*;

use crate::errors::QueueError;
use crate::state::{Queue, Task, TaskStatus};

/// Enqueues a new task into the specified queue.
///
/// # Web2 Equivalent
/// This is the "producer" side of the job queue pattern:
/// - Redis: `LPUSH queue_name payload` or `XADD stream_name * payload`
/// - RabbitMQ: `channel.basic_publish(exchange, routing_key, body)`
/// - SQS: `sqs.send_message(QueueUrl, MessageBody)`
/// - Celery: `task.delay(args)`
///
/// # On-chain Design
/// Each task is a separate PDA account derived from the queue key and a sequential
/// task ID. This differs from Web2 where tasks are rows in a message store:
/// - **Advantage**: Tasks are individually addressable and can carry their own
///   lifecycle state without table scans.
/// - **Tradeoff**: Each task account requires rent, though this is reclaimable
///   when the task is closed after completion.
///
/// # Priority & Scheduling
/// Tasks support both priority levels (0-255) and scheduled execution via
/// `execute_after`. This maps to:
/// - Redis: Sorted sets with score-based ordering
/// - SQS: DelaySeconds parameter
/// - Celery: `task.apply_async(eta=datetime)`
pub fn handler(
    ctx: Context<EnqueueTask>,
    payload: String,
    priority: u8,
    execute_after: i64,
) -> Result<()> {
    require!(payload.len() <= 512, QueueError::PayloadTooLong);

    let queue = &mut ctx.accounts.queue;
    let task_id = queue.total_tasks;

    // Initialize the task account
    let task = &mut ctx.accounts.task;
    task.queue = queue.key();
    task.task_id = task_id;
    task.creator = ctx.accounts.creator.key();
    task.worker = Pubkey::default();
    task.status = TaskStatus::Pending;
    task.priority = priority;
    task.payload = payload;
    task.result = String::new();
    task.retry_count = 0;
    task.max_retries = queue.max_retries;
    task.execute_after = execute_after;
    task.created_at = Clock::get()?.unix_timestamp;
    task.started_at = 0;
    task.completed_at = 0;
    task.bump = ctx.bumps.task;

    // Update queue counters
    queue.total_tasks = queue.total_tasks.checked_add(1).unwrap();
    queue.pending_count = queue.pending_count.checked_add(1).unwrap();

    msg!(
        "Task #{} enqueued to '{}' with priority {}",
        task_id,
        queue.name,
        priority
    );
    Ok(())
}

#[derive(Accounts)]
pub struct EnqueueTask<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Task::INIT_SPACE,
        seeds = [b"task", queue.key().as_ref(), &queue.total_tasks.to_le_bytes()],
        bump,
    )]
    pub task: Account<'info, Task>,

    #[account(mut)]
    pub queue: Account<'info, Queue>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}
