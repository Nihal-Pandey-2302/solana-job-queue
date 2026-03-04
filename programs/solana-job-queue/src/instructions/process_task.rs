use anchor_lang::prelude::*;

use crate::errors::QueueError;
use crate::events::*;
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

    require!(!queue.is_paused, QueueError::QueuePaused);

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

    // Enforce task dependencies (DAG)
    if let Some(dep_id) = task.depends_on {
        let mut remaining_accounts_iter = ctx.remaining_accounts.iter();
        let dep_account_info = next_account_info(&mut remaining_accounts_iter)
            .map_err(|_| QueueError::InvalidDependencyPda)?;
            
        // 1. Authenticate PDA derivation to prevent spoofing
        let expected_pda = Pubkey::find_program_address(
            &[b"task", queue.key().as_ref(), &dep_id.to_le_bytes()],
            ctx.program_id,
        ).0;
        
        require!(expected_pda == dep_account_info.key(), QueueError::InvalidDependencyPda);
        
        // 2. Load and verify dependency state
        let dep_data = dep_account_info.try_borrow_data()?;
        let mut data_slice: &[u8] = &dep_data;
        let dep_task = Task::try_deserialize(&mut data_slice)
            .map_err(|_| QueueError::InvalidDependencyPda)?;
            
        require!(dep_task.status == TaskStatus::Completed, QueueError::DependencyNotMet);
    }

    // State transition: Pending → Processing
    task.status = TaskStatus::Processing;
    task.worker = ctx.accounts.authority.key();
    task.started_at = now;

    // Remove task from priority heap
    queue.remove_task(task.task_id);

    // Update queue counters
    queue.pending_count = queue.pending_count.checked_sub(1).unwrap();
    queue.processing_count = queue.processing_count.checked_add(1).unwrap();

    emit!(TaskProcessed {
        queue: queue.key(),
        task_id: task.task_id,
        worker: task.worker,
        claimed_at: now,
    });

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
