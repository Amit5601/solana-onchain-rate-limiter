# Solana Rate Limiter

This project is a simple on-chain rate limiter built with Anchor on Solana.

It recreates a common Web2 pattern, where request quotas are tracked in backend state, but stores the limiter state in a Solana account instead of Redis.

## 1. Problem: API Rate Limiting in Web2

API rate limiting exists in Web2 systems to protect services from abuse, accidental overload, bot traffic, and unfair usage by a single client.

Typical reasons for rate limiting:
- prevent spam and denial-of-service patterns
- protect shared backend infrastructure
- enforce product quotas
- keep service quality stable under load
- limit how many requests a client can make in a time window

In a normal backend, the server checks whether a client has already used too many requests and either allows the request or rejects it.

## 2. Web2 Architecture

A standard Web2 rate limiter often looks like this:

`Client -> API -> Redis counter`

Flow:
1. A client sends a request to an API server.
2. The backend identifies the caller by API key, user id, IP, wallet, or session.
3. The API checks a counter in Redis.
4. If the counter is below the configured limit, the request is allowed and the counter is incremented.
5. If the counter is at the limit, the request is rejected, usually with HTTP 429.

Redis is commonly used because it is centralized, fast, and cheap to update on every request.

## 3. Solana Architecture

This project maps the same idea to Solana:

`Client -> Solana program -> RateLimitAccount`

Flow:
1. A client sends a transaction to the Solana program.
2. The program derives the owner's rate limiter PDA.
3. The program reads the current counter state from `RateLimitAccount`.
4. If the active time window has expired, the counter is reset.
5. If the request count is still below the limit, the counter is incremented.
6. If the request count has already reached the limit, the transaction returns a custom on-chain error.

This makes the rate-limiter state transparent and verifiable on chain.

## 4. Account Model

The main account is `RateLimitAccount`.

Fields:
- `owner: Pubkey`
- `request_count: u64`
- `window_start: i64`
- `limit: u64`
- `window_duration: i64`

Meaning:
- `owner`: the wallet that owns this limiter state
- `request_count`: number of accepted requests in the current window
- `window_start`: unix timestamp for the start of the current window
- `limit`: max allowed requests in one window
- `window_duration`: window size in seconds

PDA seeds:
- `[b"rate_limit", owner.as_ref()]`

This gives one limiter account per owner.

Account size:
- 8 bytes discriminator
- 32 bytes `Pubkey`
- 8 bytes `u64`
- 8 bytes `i64`
- 8 bytes `u64`
- 8 bytes `i64`
- total: `72` bytes

## 5. Instruction Design

### `initialize_limiter`
Creates the PDA-backed `RateLimitAccount` and stores the limiter configuration.

Inputs:
- `limit`
- `window_duration`

Behavior:
- creates the limiter PDA
- sets the owner
- sets `request_count = 0`
- sets `window_start = 0`
- stores the configured limit and window duration

### `check_request`
Checks whether a request is allowed.

Behavior:
1. gets the current unix timestamp from Solana `Clock`
2. if `current_time - window_start > window_duration`, resets the window
3. if `request_count >= limit`, returns `RateLimitExceeded`
4. otherwise increments `request_count`

Errors:
- `RateLimitExceeded`
- `Unauthorized`
- `InvalidLimiter`

## 6. Devnet Program ID

Submitted Devnet program:
- `88JwScoavVyiG2KCQt1tewbM7yrBJ8LN7cuKjebDmyLN`

Explorer:
- [Program on Devnet](https://explorer.solana.com/address/88JwScoavVyiG2KCQt1tewbM7yrBJ8LN7cuKjebDmyLN?cluster=devnet)

## 7. Devnet Transaction Links

Deployment:
- [Deploy / upgrade transaction](https://explorer.solana.com/tx/Sg4G6Tjred7jtknP1UZg9iuoEs38pmk3R4kCXScGWFzLb8JWF7P5eazR5jmFXQHcQKsYpknejWk97d9Dj9hmDww?cluster=devnet)

CLI test transactions:
- [Initialize limiter](https://explorer.solana.com/tx/5dMeHeycJkUXxSK4C3Rdnsu724V5ZJyhcntjJ6jvaw2aEjetdibBYUZewdzTLicLNjHvbhMM2L8TgzAfYa9ivyoY?cluster=devnet)
- [Check request #1](https://explorer.solana.com/tx/3ASLhSaDcShocbbEzLMJGFeZPpf7AFwB2bFUU7WK3obUHhNFfF8zcDkP3o1npgNmXf8ZSxkdmWKaetMssjVeXmbf?cluster=devnet)
- [Check request #2](https://explorer.solana.com/tx/48CWG8kWDKKdboBX5DSAimDVAWmFFNPqRjGRAVukcBp7tHEKA38c2VTz9KK6a7KyVkkkY2XbcADw2WwDGJ6hwRps?cluster=devnet)

Observed result:
- the first two `check-request` calls succeeded
- the third `check-request` call failed with `RateLimitExceeded`
- this confirmed the on-chain fixed-window limiter behavior

## 8. How To Run The Project Locally

### Prerequisites
Install:
- Rust
- Solana CLI
- Anchor CLI
- Node.js
- npm

### Build the program
```bash
anchor build
```

### Run tests
```bash
anchor test
```

### Configure Solana
For local validator:
```bash
solana config set --url localhost
```

For Devnet:
```bash
solana config set --url devnet
```

### Deploy to Devnet
```bash
anchor deploy
```

If needed, direct deploy with Solana CLI:
```bash
solana program deploy target/deploy/rate_limiter.so --program-id target/deploy/rate_limiter-keypair.json
```

### Run the CLI
Initialize a limiter:
```bash
ts-node client/cli.ts initialize-limiter --limit 2 --window-duration 60
```

Check a request:
```bash
ts-node client/cli.ts check-request
```

## Project Structure

- `programs/rate-limiter/src/lib.rs`
- `programs/rate-limiter/src/state.rs`
- `programs/rate-limiter/src/errors.rs`
- `programs/rate-limiter/src/instructions/initialize_limiter.rs`
- `programs/rate-limiter/src/instructions/check_request.rs`
- `tests/rate-limiter.ts`
- `client/cli.ts`

## Summary

This project demonstrates how a traditional backend rate limiter can be modeled on Solana using program-owned accounts and fixed-window quota logic.

Instead of `Client -> API -> Redis`, the system becomes `Client -> Solana program -> RateLimitAccount`, with quota enforcement happening on chain.
