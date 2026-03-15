import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("rate-limiter", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.RateLimiter as Program;

  const deriveLimiterPda = (owner: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("rate_limit"), owner.toBuffer()],
      program.programId
    );
  };

  const initializeLimiter = async (
    owner: PublicKey,
    limit: number,
    windowDuration: number
  ) => {
    const [rateLimitAccount] = deriveLimiterPda(owner);

    await program.methods
      .initializeLimiter(new anchor.BN(limit), new anchor.BN(windowDuration))
      .accounts({
        payer: provider.wallet.publicKey,
        owner,
        rateLimitAccount,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return rateLimitAccount;
  };

  it("initialize limiter", async () => {
    const owner = Keypair.generate().publicKey;
    const rateLimitAccount = await initializeLimiter(owner, 3, 60);

    const account = await (program.account as any).rateLimitAccount.fetch(rateLimitAccount);

    assert.isTrue(account.owner.equals(owner));
    assert.strictEqual(account.requestCount.toNumber(), 0);
    assert.strictEqual(account.windowStart.toNumber(), 0);
    assert.strictEqual(account.limit.toNumber(), 3);
    assert.strictEqual(account.windowDuration.toNumber(), 60);
  });

  it("allow requests under limit", async () => {
    const owner = Keypair.generate();
    const rateLimitAccount = await initializeLimiter(owner.publicKey, 3, 60);

    await program.methods
      .checkRequest()
      .accounts({
        owner: owner.publicKey,
        rateLimitAccount,
      })
      .signers([owner])
      .rpc();

      const account = await (program.account as any).rateLimitAccount.fetch(rateLimitAccount);
      assert.strictEqual(account.requestCount.toNumber(), 1);
  });

  it("reject request when limit exceeded", async () => {
    const owner = Keypair.generate();
    const rateLimitAccount = await initializeLimiter(owner.publicKey, 2, 60);

    await program.methods
      .checkRequest()
      .accounts({
        owner: owner.publicKey,
        rateLimitAccount,
      })
      .signers([owner])
      .rpc();

    await program.methods
      .checkRequest()
      .accounts({
        owner: owner.publicKey,
        rateLimitAccount,
      })
      .signers([owner])
      .rpc();

    try {
      await program.methods
        .checkRequest()
        .accounts({
          owner: owner.publicKey,
          rateLimitAccount,
        })
        .signers([owner])
        .rpc();

      assert.fail("expected request to be rejected once limit was exceeded");
    } catch (error) {
      const message = `${error}`;
      assert.include(message, "Rate limit exceeded");
    }
  });

  it("reset window after expiration", async () => {
    const owner = Keypair.generate();
    const rateLimitAccount = await initializeLimiter(owner.publicKey, 1, 1);

    await program.methods
      .checkRequest()
      .accounts({
        owner: owner.publicKey,
        rateLimitAccount,
      })
      .signers([owner])
      .rpc();

    await new Promise((resolve) => setTimeout(resolve, 2000));

    await program.methods
      .checkRequest()
      .accounts({
        owner: owner.publicKey,
        rateLimitAccount,
      })
      .signers([owner])
      .rpc();

      const account = await (program.account as any).rateLimitAccount.fetch(rateLimitAccount);
      assert.strictEqual(account.requestCount.toNumber(), 1);
    assert.isAbove(account.windowStart.toNumber(), 0);
  });
});
