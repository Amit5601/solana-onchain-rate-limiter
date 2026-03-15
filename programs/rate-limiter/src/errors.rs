use anchor_lang::prelude::*;

#[error_code]
pub enum RateLimiterError {
    #[msg("Rate limit exceeded")]
    RateLimitExceeded,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid limiter")]
    InvalidLimiter,
}
