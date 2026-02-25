use anchor_lang::prelude::*;

use crate::state::{Queue, Worker};

/// Registers a new worker for a specific queue.
///
/// # Web2 Equivalent
/// This is analogous to a Celery worker announcing itself to the broker,
/// or an SQS consumer starting to poll a queue. In Web2, workers are typically
/// processes/containers that connect to the message broker.
///
/// # On-chain Design
/// Workers are represented as PDA accounts, creating an on-chain registry of
/// authorized consumers. This enables:
/// - Access control (only registered workers can process tasks)
/// - Worker performance tracking (tasks completed/failed)
/// - Worker lifecycle management (activate/deactivate)
pub fn handler(ctx: Context<RegisterWorker>) -> Result<()> {
    let worker = &mut ctx.accounts.worker;
    worker.queue = ctx.accounts.queue.key();
    worker.authority = ctx.accounts.authority.key();
    worker.tasks_completed = 0;
    worker.tasks_failed = 0;
    worker.is_active = true;
    worker.registered_at = Clock::get()?.unix_timestamp;
    worker.bump = ctx.bumps.worker;

    msg!(
        "Worker {} registered for queue '{}'",
        worker.authority,
        ctx.accounts.queue.name
    );
    Ok(())
}

#[derive(Accounts)]
pub struct RegisterWorker<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Worker::INIT_SPACE,
        seeds = [b"worker", queue.key().as_ref(), authority.key().as_ref()],
        bump,
    )]
    pub worker: Account<'info, Worker>,

    /// The queue this worker will serve.
    pub queue: Account<'info, Queue>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}
