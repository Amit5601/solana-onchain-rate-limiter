use anchor_lang::prelude::*;

#[account]
pub struct RateLimitAccount {
    pub owner: Pubkey,
    pub request_count: u64,
    pub window_start: i64,
    pub limit: u64,
    pub window_duration: i64,
}

impl RateLimitAccount {
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 8 + 8;
}
