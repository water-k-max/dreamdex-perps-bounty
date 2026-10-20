import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const ENV_PATH = ".env";
const TEMPLATE_PATH = ".env.example";

function readKeyFromEnv(): string | undefined {
  if (!existsSync(ENV_PATH)) return undefined;
  const match = readFileSync(ENV_PATH, "utf8").match(/^PRIVATE_KEY=(0x[0-9a-fA-F]{64})$/m);
  return match?.[1];
}

const existing = readKeyFromEnv();
const privateKey = existing ?? generatePrivateKey();
const account = privateKeyToAccount(privateKey as `0x${string}`);

if (!existing) {
  const template = readFileSync(TEMPLATE_PATH, "utf8");
  const env = template
    .replace(/^PRIVATE_KEY=.*$/m, `PRIVATE_KEY=${privateKey}`)
    .replace(/^WALLET_ADDRESS=.*$/m, `WALLET_ADDRESS=${account.address}`);
  writeFileSync(ENV_PATH, env, { mode: 0o600 });
  chmodSync(ENV_PATH, 0o600);
  console.log("Created .env with a new throwaway testnet key (not printed).");
} else {
  console.log("Using the existing key in .env (not printed).");
}

console.log(`Wallet address: ${account.address}`);
console.log("");
console.log("Fund this address with a small amount of STT on Somnia Tokyo/Hideki");
console.log("(chain 50383). About 1 STT covers many test transactions.");
console.log("Never send mainnet funds to this account.");
