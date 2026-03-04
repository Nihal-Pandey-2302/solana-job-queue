use anchor_lang::prelude::*;

use crate::events::*;
use crate::state::Queue;

pub fn handler(ctx: Context<ResumeQueue>) -> Result<()> {
    let queue = &mut ctx.accounts.queue;
    queue.is_paused = false;
    queue.pause_reason = String::new();

    emit!(QueueResumedEvent {
        queue: queue.key(),
        authority: ctx.accounts.authority.key(),
    });

    msg!("Queue '{}' resumed execution.", queue.name);
    Ok(())
}

#[derive(Accounts)]
pub struct ResumeQueue<'info> {
    #[account(
        mut,
        has_one = authority,
    )]
    pub queue: Account<'info, Queue>,
    
    pub authority: Signer<'info>,
}
