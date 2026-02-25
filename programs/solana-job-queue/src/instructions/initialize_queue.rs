use anchor_lang::prelude::*;

use crate::errors::QueueError;
use crate::state::Queue;

/// Creates a new task queue.
///
/// # Web2 Equivalent
/// This is analogous to creating a new queue/topic in Redis, RabbitMQ, or AWS SQS.
/// In Redis: `XGROUP CREATE myqueue mygroup $ MKSTREAM`
/// In SQS: `aws sqs create-queue --queue-name myqueue`
///
/// # On-chain Design
/// The queue is stored as a PDA derived from the authority's public key and the queue name,
/// ensuring globally unique, collision-free queue identifiers without a central registry.
pub fn handler(ctx: Context<InitializeQueue>, name: String, max_retries: u8) -> Result<()> {
    require!(name.len() <= 32, QueueError::QueueNameTooLong);

    let queue = &mut ctx.accounts.queue;
    queue.authority = ctx.accounts.authority.key();
    queue.name = name;
    queue.total_tasks = 0;
    queue.pending_count = 0;
    queue.processing_count = 0;
    queue.completed_count = 0;
    queue.failed_count = 0;
    queue.max_retries = max_retries;
    queue.created_at = Clock::get()?.unix_timestamp;
    queue.bump = ctx.bumps.queue;

    msg!("Queue '{}' initialized", queue.name);
    Ok(())
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct InitializeQueue<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Queue::INIT_SPACE,
        seeds = [b"queue", authority.key().as_ref(), name.as_bytes()],
        bump,
    )]
    pub queue: Account<'info, Queue>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}
