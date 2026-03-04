use anchor_lang::prelude::*;

use crate::errors::QueueError;
use crate::events::*;
use crate::state::Queue;

pub fn handler(
    ctx: Context<PauseQueue>,
    reason: String,
) -> Result<()> {
    require!(reason.len() <= 64, QueueError::InvalidPauseReason);
    
    let queue = &mut ctx.accounts.queue;
    queue.is_paused = true;
    queue.paused_at = Clock::get()?.unix_timestamp;
    queue.pause_reason = reason;

    emit!(QueuePausedEvent {
        queue: queue.key(),
        reason: queue.pause_reason.clone(),
        authority: ctx.accounts.authority.key(),
    });

    msg!("Queue '{}' paused. Reason: {}", queue.name, queue.pause_reason);
    Ok(())
}

#[derive(Accounts)]
pub struct PauseQueue<'info> {
    #[account(
        mut,
        has_one = authority,
    )]
    pub queue: Account<'info, Queue>,
    
    pub authority: Signer<'info>,
}
