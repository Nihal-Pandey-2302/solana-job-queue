use anchor_lang::prelude::*;

use crate::state::{Queue, Worker};

/// Deregisters a worker, preventing it from processing further tasks.
///
/// # Web2 Equivalent
/// Analogous to gracefully shutting down a Celery worker or stopping
/// an SQS consumer. The worker's historical performance data is preserved
/// until the account is explicitly closed.
///
/// # On-chain Design
/// Rather than deleting the account (which would lose performance data),
/// we set `is_active = false`. This is a soft-delete that preserves the
/// worker's task completion history on-chain for auditing.
pub fn handler(ctx: Context<DeregisterWorker>) -> Result<()> {
    let worker = &mut ctx.accounts.worker;
    worker.is_active = false;

    msg!(
        "Worker {} deregistered from queue '{}'",
        worker.authority,
        ctx.accounts.queue.name
    );
    Ok(())
}

#[derive(Accounts)]
pub struct DeregisterWorker<'info> {
    #[account(
        mut,
        seeds = [b"worker", queue.key().as_ref(), authority.key().as_ref()],
        bump = worker.bump,
        has_one = authority,
        has_one = queue,
    )]
    pub worker: Account<'info, Worker>,

    pub queue: Account<'info, Queue>,

    pub authority: Signer<'info>,
}
