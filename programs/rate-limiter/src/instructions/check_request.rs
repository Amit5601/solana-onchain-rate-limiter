use anchor_lang::prelude::*;

use crate::errors::RateLimiterError;
use crate::state::RateLimitAccount;

#[derive(Accounts)]
pub struct CheckRequest<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"rate_limit", owner.key().as_ref()],
        bump,
        constraint = rate_limit_account.owner == owner.key() @ RateLimiterError::Unauthorized
    )]
    pub rate_limit_account: Account<'info, RateLimitAccount>,
}

pub fn handler(ctx: Context<CheckRequest>) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    let rate_limit_account = &mut ctx.accounts.rate_limit_account;

    if current_time - rate_limit_account.window_start > rate_limit_account.window_duration {
        rate_limit_account.request_count = 0;
        rate_limit_account.window_start = current_time;
    }

    require!(
        rate_limit_account.request_count < rate_limit_account.limit,
        RateLimiterError::RateLimitExceeded
    );

    rate_limit_account.request_count += 1;

    Ok(())
}
