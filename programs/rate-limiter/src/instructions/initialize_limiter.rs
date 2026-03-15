use anchor_lang::prelude::*;

use crate::errors::RateLimiterError;
use crate::state::RateLimitAccount;

#[derive(Accounts)]
pub struct InitializeLimiter<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: This is the subject the limiter belongs to and is stored in program state.
    pub owner: UncheckedAccount<'info>,
    #[account(
        init,
        payer = payer,
        space = RateLimitAccount::SPACE,
        seeds = [b"rate_limit", owner.key().as_ref()],
        bump
    )]
    pub rate_limit_account: Account<'info, RateLimitAccount>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeLimiter>,
    limit: u64,
    window_duration: i64,
) -> Result<()> {
    require!(window_duration > 0, RateLimiterError::InvalidLimiter);

    let rate_limit_account = &mut ctx.accounts.rate_limit_account;
    rate_limit_account.owner = ctx.accounts.owner.key();
    rate_limit_account.request_count = 0;
    rate_limit_account.window_start = 0;
    rate_limit_account.limit = limit;
    rate_limit_account.window_duration = window_duration;

    Ok(())
}
