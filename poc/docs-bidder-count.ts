// Docs say no backstop bidders are registered on testnet; the engine reports one.
// Read-only: no signer, no writes.
import { writeFileSync } from "node:fs";
import { parseAbi, type Address } from "viem";
import { createMarkets } from "../src/sdk.js";

const DOCS_URL = "https://app.testnet.dreamdex.io/docs/trading/perps-testnet/margin-and-liquidations";

const markets = createMarkets({ withSigner: false });
const client = markets.client;
const viem = client.getViemClient();
const list = await client.listPerpMarkets({ limit: 100 });
const first = list[0];
if (!first) throw new Error("no perp markets returned");

const before = await viem.getBlockNumber();
const system = await client.getPerpSystemConfig(first.marginBank);
const config = await client.getLiquidationEngineConfig(system.liquidationEngine);
const engineAbi = parseAbi(["function getBidders() view returns (address[])"]);
const bidders = await viem.readContract({
  address: system.liquidationEngine,
  abi: engineAbi,
  functionName: "getBidders",
  blockNumber: before,
});
const bidderCodeBytes = [];
for (const bidder of bidders) {
  const code = await viem.getCode({ address: bidder, blockNumber: before });
  bidderCodeBytes.push({ address: bidder, runtimeCodeBytes: code ? (code.length - 2) / 2 : 0 });
}
const after = await viem.getBlockNumber();

console.log(`chain 50383, block ${before}..${after}`);
console.log(`MarginBank ${first.marginBank}`);
console.log(`LiquidationEngine ${system.liquidationEngine}`);
console.log(`engine.marginBank ${config.marginBank}`);
console.log(`penaltyBps ${config.penaltyBps}`);
console.log(`minSpreadBps ${config.minSpreadBps}`);
console.log(`maxSpreadBps ${config.maxSpreadBps}`);
console.log(`maxVolumePerBlock ${config.maxVolumePerBlock}`);
console.log(`bidderCount ${config.bidderCount}`);
console.log(`getBidders ${JSON.stringify(bidderCodeBytes)}`);
console.log(`\ndocs claim: "No backstop bidders are registered on testnet, so the later stages come in sooner."`);
console.log(`docs claim holds: ${config.bidderCount === 0n}`);

const snapshot = {
  capturedAt: new Date().toISOString(),
  chainId: 50383,
  blockNumberBefore: before.toString(),
  blockNumberAfter: after.toString(),
  marginBank: first.marginBank,
  liquidationEngine: system.liquidationEngine,
  config: {
    address: config.address,
    marginBank: config.marginBank,
    penaltyBps: config.penaltyBps.toString(),
    minSpreadBps: config.minSpreadBps.toString(),
    maxSpreadBps: config.maxSpreadBps.toString(),
    maxVolumePerBlock: config.maxVolumePerBlock.toString(),
    bidderCount: config.bidderCount.toString(),
  },
  bidders: bidderCodeBytes,
  docs: {
    url: DOCS_URL,
    quote: "No backstop bidders are registered on testnet, so the later stages come in sooner.",
  },
};
writeFileSync("evidence/docs-bidder-count.json", JSON.stringify(snapshot, null, 2));
console.log("\nWrote evidence/docs-bidder-count.json");
process.exit(0);
