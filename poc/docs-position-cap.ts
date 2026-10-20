// Docs say each account's position cap is a tenth of the market OI cap on most
// markets. Read the two caps from every pool at one block and compare.
// Read-only: no signer, no writes.
import { writeFileSync } from "node:fs";
import { createPublicClient, http, parseAbi } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { createMarkets } from "../src/sdk.js";
import { config } from "../src/config.js";

const DOCS_URL = "https://app.testnet.dreamdex.io/docs/developers/perps-testnet";

const poolAbi = parseAbi([
  "function getPerpPoolParameters() view returns ((uint256 initialMarginBps, uint256 maintenanceMarginBps, uint256 closeOutMarginBps, uint256 maxOpenInterest, uint256 maxPositionSize, uint256 takerFeeBpsTimes1k, int256 makerFeeBpsTimes1k, uint256 insuranceFundShareBps))",
]);

const markets = createMarkets({ withSigner: false });
const pub = createPublicClient({ chain: hidekiTestnet, transport: http(config.rpcUrl) });
const list = await markets.client.listPerpMarkets({ limit: 100 });
const blockNumber = await pub.getBlockNumber();

const rows = [];
for (const market of list) {
  const params = await pub.readContract({
    address: market.poolAddress as `0x${string}`,
    abi: poolAbi,
    functionName: "getPerpPoolParameters",
    blockNumber,
  });
  const maxPositionSize = BigInt(params.maxPositionSize);
  const maxOpenInterest = BigInt(params.maxOpenInterest);
  const ratioBps = maxOpenInterest === 0n ? null : Number((maxPositionSize * 10_000n) / maxOpenInterest);
  rows.push({
    symbol: market.baseSymbol,
    pool: market.poolAddress,
    maxPositionSize: maxPositionSize.toString(),
    maxOpenInterest: maxOpenInterest.toString(),
    capOfOiBps: ratioBps,
    docsOneTenth: ratioBps === 1000,
  });
}

console.log(`chain 50383, block ${blockNumber}`);
console.log("symbol".padEnd(12), "maxPosition".padEnd(24), "maxOpenInterest".padEnd(24), "cap/OI");
for (const row of rows) {
  const label = row.capOfOiBps === null ? "n/a" : `${(row.capOfOiBps / 100).toFixed(2)}%`;
  console.log(String(row.symbol).padEnd(12), row.maxPositionSize.padEnd(24), row.maxOpenInterest.padEnd(24), label);
}

const tenth = rows.filter((r) => r.docsOneTenth).length;
console.log(`\nmarkets: ${rows.length}`);
console.log(`cap is exactly one tenth of OI cap: ${tenth}`);
console.log(`docs claim ("a tenth ... on most markets") holds: ${tenth > rows.length / 2}`);

const snapshot = {
  capturedAt: new Date().toISOString(),
  chainId: 50383,
  blockNumber: blockNumber.toString(),
  docs: {
    url: DOCS_URL,
    quote:
      "Each account has a position cap per market, a tenth of the market's open interest cap on most markets. An order that would take the account past it reverts with MaxPositionSizeExceeded() (0x714b36d6); getMaxPerpOrderSize reports the cap as maxPositionSize.",
  },
  rows,
  summary: { markets: rows.length, exactlyOneTenth: tenth, claimHolds: tenth > rows.length / 2 },
};
writeFileSync("evidence/docs-position-cap.json", JSON.stringify(snapshot, null, 2));
console.log("\nWrote evidence/docs-position-cap.json");
process.exit(0);
