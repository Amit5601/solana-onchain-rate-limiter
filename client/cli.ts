import * as anchor from "@coral-xyz/anchor";
import { Idl, Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

type Command = "initialize-limiter" | "check-request";

type ParsedArgs = {
  command: Command;
  options: Record<string, string>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;

  if (command !== "initialize-limiter" && command !== "check-request") {
    throw new Error(
      "Usage:\n" +
        "  ts-node client/cli.ts initialize-limiter --limit <number> --window-duration <seconds> [--owner <pubkey>]\n" +
        "  ts-node client/cli.ts check-request [--owner <pubkey>]"
    );
  }

  const options: Record<string, string> = {};

  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];

    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument pair near: ${key ?? "<missing>"}`);
    }

    options[key.slice(2)] = value;
  }

  return { command, options };
}

function loadIdl(): Idl {
  const idlPath = path.resolve(__dirname, "../target/idl/rate_limiter.json");

  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL not found at ${idlPath}. Build the Anchor program first.`);
  }

  return JSON.parse(fs.readFileSync(idlPath, "utf8")) as Idl;
}

function getProgramId(idl: Idl): PublicKey {
  const address = (idl as Idl & { address?: string }).address;

  if (!address) {
    throw new Error("Program address missing from IDL.");
  }

  return new PublicKey(address);
}

function parseOwner(provider: anchor.AnchorProvider, ownerArg?: string): PublicKey {
  if (!ownerArg) {
    return provider.wallet.publicKey;
  }

  const owner = new PublicKey(ownerArg);

  if (!owner.equals(provider.wallet.publicKey)) {
    throw new Error(
      "The current program requires the owner account to sign. Use the provider wallet as the owner."
    );
  }

  return owner;
}

function deriveLimiterPda(programId: PublicKey, owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("rate_limit"), owner.toBuffer()],
    programId
  );
}

async function initializeLimiter(
  program: Program<Idl>,
  provider: anchor.AnchorProvider,
  options: Record<string, string>
) {
  const limit = options.limit;
  const windowDuration = options["window-duration"];

  if (!limit || !windowDuration) {
    throw new Error("initialize-limiter requires --limit and --window-duration.");
  }

  const owner = parseOwner(provider, options.owner);
  const [rateLimitAccount] = deriveLimiterPda(program.programId, owner);

  const signature = await program.methods
    .initializeLimiter(new anchor.BN(limit), new anchor.BN(windowDuration))
    .accounts({
      payer: provider.wallet.publicKey,
      owner,
      rateLimitAccount,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Limiter initialized");
  console.log("Owner:", owner.toBase58());
  console.log("RateLimitAccount:", rateLimitAccount.toBase58());
  console.log("Signature:", signature);
}

async function checkRequest(
  program: Program<Idl>,
  provider: anchor.AnchorProvider,
  options: Record<string, string>
) {
  const owner = parseOwner(provider, options.owner);
  const [rateLimitAccount] = deriveLimiterPda(program.programId, owner);

  const signature = await program.methods
    .checkRequest()
    .accounts({
      owner,
      rateLimitAccount,
    })
    .rpc();

  const accountNamespace = program.account as Record<string, { fetch: (pubkey: PublicKey) => Promise<any> }>;
  const account = await accountNamespace.rateLimitAccount.fetch(rateLimitAccount);

  console.log("Request accepted");
  console.log("Owner:", owner.toBase58());
  console.log("RateLimitAccount:", rateLimitAccount.toBase58());
  console.log("RequestCount:", account.requestCount.toString());
  console.log("WindowStart:", account.windowStart.toString());
  console.log("Signature:", signature);
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const { command, options } = parseArgs(process.argv.slice(2));
  const idl = loadIdl();
  getProgramId(idl);
  const program = new Program(idl, provider);

  if (command === "initialize-limiter") {
    await initializeLimiter(program, provider, options);
    return;
  }

  await checkRequest(program, provider, options);
}

main().catch((error) => {
  console.error("CLI error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
