// Docs say funding missed between touches is all settled at once. Indexed settlements
// show the contract accruing at most one interval and forgiving the rest.
// Read-only: no signer, no writes.
import { writeFileSync } from "node:fs";
import { createPublicClient, http, parseAbi } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { createMarkets } from "../src/sdk.js";
import { config } from "../src/config.js";

const DOCS_URL = "https://app.testnet.dreamdex.io/docs/trading/perps-testnet/funding";
const SDK_DOC =
  "node_modules/@somnia-chain/markets-sdk/src/perp/history.ts: the contract's catch-up " +
  "horizon charges at most one interval per settlement however long the gap, so a value " +
  "below intervalsSettled means the excess was FORGIVEN at zero funding rather than deferred.";

const markets = createMarkets({ withSigner: false });
const client = markets.client;
const list = await client.listPerpMarkets({ limit: 100 });
const pool = list.find((m) => m.baseSymbol === "LIT");
if (!pool) throw new Error("LIT market not returned");

const pub = createPublicClient({ chain: hidekiTestnet, transport: http(config.rpcUrl) });
const fundingAbi = parseAbi([
  "function getCumulativeFundingPerUnit() view returns (int256)",
  "function getLastFundingUpdateTimestampNs() view returns (uint64)",
]);

// 2026-10-17 09:03:12 UTC settlement, the first after a multi-hour funding outage.
const rows = await client.listFundingRateHistory(pool.poolAddress, {
  from: 1792227700,
  to: 1792227800,
  order: "asc",
});
const row = rows.find((r) => BigInt(r.intervalsSettled) > BigInt(r.intervalsAccrued));
if (!row) throw new Error(`no forgiven settlement in window; got ${JSON.stringify(rows)}`);

const settledSeconds = BigInt(row.intervalsSettled) * BigInt(row.fundingIntervalSec);
const accruedSeconds = BigInt(row.spanEnd) - BigInt(row.spanStart);
const forgivenSeconds = settledSeconds - accruedSeconds;

// On-chain cross-check: the anchor advances over the whole gap, but the cumulative
// funding index moves by one interval's rate only.
const settlementBlock = BigInt(row.blockNumber);
const poolAddress = pool.poolAddress as `0x${string}`;
const [cumulativeBefore, cumulativeAfter, anchorBefore, anchorAfter] = await Promise.all([
  pub.readContract({ address: poolAddress, abi: fundingAbi, functionName: "getCumulativeFundingPerUnit", blockNumber: settlementBlock - 1n }),
  pub.readContract({ address: poolAddress, abi: fundingAbi, functionName: "getCumulativeFundingPerUnit", blockNumber: settlementBlock }),
  pub.readContract({ address: poolAddress, abi: fundingAbi, functionName: "getLastFundingUpdateTimestampNs", blockNumber: settlementBlock - 1n }),
  pub.readContract({ address: poolAddress, abi: fundingAbi, functionName: "getLastFundingUpdateTimestampNs", blockNumber: settlementBlock }),
]);
const cumulativeDelta = cumulativeAfter - cumulativeBefore;
const anchorJumpSeconds = (anchorAfter - anchorBefore) / 1_000_000_000n;
const intervalsPerWindow = BigInt(row.fundingWindowSec) / BigInt(row.fundingIntervalSec);
const oneIntervalCharge = (BigInt(row.indexPrice) * BigInt(row.fundingRate)) / intervalsPerWindow;
const allIntervalsCharge = oneIntervalCharge * BigInt(row.intervalsSettled);
const chargedOneInterval = cumulativeDelta === oneIntervalCharge;
const chargedAllIntervals = cumulativeDelta === allIntervalsCharge;

console.log(`pool ${pool.baseSymbol} ${pool.poolAddress}`);
console.log(`on-chain rate denominator fundingWindowSec=${row.fundingWindowSec}, settlement fundingIntervalSec=${row.fundingIntervalSec}`);
console.log(`row ${row.id}`);
console.log(`block ${row.blockNumber} tx ${row.txHash}`);
console.log(`timestamp ${row.timestamp} (${new Date(Number(row.timestamp) * 1000).toISOString()})`);
console.log(`intervalsSettled=${row.intervalsSettled} intervalsAccrued=${row.intervalsAccrued}`);
console.log(`spanStart=${row.spanStart} spanEnd=${row.spanEnd}`);
console.log(`settled span ${settledSeconds}s (${row.intervalsSettled} intervals)`);
console.log(`accrued span ${accruedSeconds}s; forgiven ${forgivenSeconds}s`);
console.log(`on-chain anchor ${anchorBefore} -> ${anchorAfter} (jump ${anchorJumpSeconds}s = ${anchorJumpSeconds / BigInt(row.fundingIntervalSec)} intervals)`);
console.log(`on-chain cumulative funding delta ${cumulativeDelta}`);
console.log(`one interval at row rate ${oneIntervalCharge}; ${row.intervalsSettled} intervals ${allIntervalsCharge}`);
console.log(`=> charged exactly one interval: ${chargedOneInterval}; charged every interval: ${chargedAllIntervals}`);
console.log(`\ndocs claim: "everything owed since the last time is settled at once. The result is the same as paying every hour."`);
console.log(`=> claim holds: ${forgivenSeconds === 0n}`);

const snapshot = {
  capturedAt: new Date().toISOString(),
  chainId: 50383,
  docs: {
    url: DOCS_URL,
    quote:
      "Funding is applied to your position the next time it is touched, by a trade, a withdrawal or a liquidation, and everything owed since the last time is settled at once. The result is the same as paying every hour.",
  },
  sdkCorrection: SDK_DOC,
  pool: { symbol: pool.baseSymbol, address: pool.poolAddress },
  row,
  computed: {
    settledSeconds: settledSeconds.toString(),
    accruedSeconds: accruedSeconds.toString(),
    forgivenSeconds: forgivenSeconds.toString(),
  },
  onChain: {
    settlementBlock: settlementBlock.toString(),
    anchorBefore: anchorBefore.toString(),
    anchorAfter: anchorAfter.toString(),
    anchorJumpSeconds: anchorJumpSeconds.toString(),
    cumulativeBefore: cumulativeBefore.toString(),
    cumulativeAfter: cumulativeAfter.toString(),
    cumulativeDelta: cumulativeDelta.toString(),
    oneIntervalCharge: oneIntervalCharge.toString(),
    allIntervalsCharge: allIntervalsCharge.toString(),
    chargedOneInterval,
    chargedAllIntervals,
  },
  claimHolds: forgivenSeconds === 0n,
};
writeFileSync("evidence/docs-funding-catchup.json", JSON.stringify(snapshot, null, 2));
console.log("\nWrote evidence/docs-funding-catchup.json");
process.exit(0);
