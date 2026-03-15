use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("88JwScoavVyiG2KCQt1tewbM7yrBJ8LN7cuKjebDmyLN");

#[program]
pub mod rate_limiter {
    use super::*;

    pub fn initialize_limiter(
        ctx: Context<InitializeLimiter>,
        limit: u64,
        window_duration: i64,
    ) -> Result<()> {
        instructions::initialize_limiter::handler(ctx, limit, window_duration)
    }

    pub fn check_request(ctx: Context<CheckRequest>) -> Result<()> {
        instructions::check_request::handler(ctx)
    }
}
