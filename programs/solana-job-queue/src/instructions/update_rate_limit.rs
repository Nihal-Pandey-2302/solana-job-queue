use anchor_lang::prelude::*;

use crate::state::Queue;

pub fn handler(
    ctx: Context<UpdateRateLimit>,
    enabled: bool,
    max_tasks_per_window: u32,
    window_duration_seconds: i64,
) -> Result<()> {
    let queue = &mut ctx.accounts.queue;

    queue.rate_limit_enabled = enabled;
    queue.max_tasks_per_window = max_tasks_per_window;
    queue.window_duration_seconds = window_duration_seconds;
    
    // Reset the window to start immediately
    queue.current_window_start = Clock::get()?.unix_timestamp;
    queue.current_window_count = 0;

    msg!(
        "Rate limit updated for queue '{}': {} tasks per {} seconds",
        queue.name,
        max_tasks_per_window,
        window_duration_seconds
    );

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateRateLimit<'info> {
    #[account(
        mut,
        has_one = authority,
    )]
    pub queue: Account<'info, Queue>,
    
    pub authority: Signer<'info>,
}
