// Testnet docs say every pool caps builder fees at 100000 (100 BPS), and elsewhere that
// the testnet cap is 0. On chain, all 21 perp pools cap at 10000 (10 BPS) and all 3 spot
// pools at 100000. Read-only: no signer, no writes; every chain read is pinned.
import { writeFileSync } from "node:fs";
import { parseAbi, type Address } from "viem";
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { createMarkets } from "../src/sdk.js";

const ERRORS_URL = "https://app.testnet.dreamdex.io/docs/developers/contracts/errors.md";
const FUNCTIONS_URL = "https://app.testnet.dreamdex.io/docs/developers/contracts/functions.md";

const errorsClaim = "Every mainnet and testnet pool currently runs a `100000` (100 BPS) cap";
const functionsClaim = "the cap is `100000` (100 BPS = 1%) on every pool on both networks";
const functionsZeroClaim = "Currently `100000` (100 BPS = 1%) on mainnet and `0` on testnet.";

async function fetchDoc(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return (await response.text()).replace(/\s+/g, " ");
}

const [errorsDoc, functionsDoc] = await Promise.all([fetchDoc(ERRORS_URL), fetchDoc(FUNCTIONS_URL)]);
for (const [url, doc, claim] of [
  [ERRORS_URL, errorsDoc, errorsClaim],
  [FUNCTIONS_URL, functionsDoc, functionsClaim],
  [FUNCTIONS_URL, functionsDoc, functionsZeroClaim],
] as const) {
  if (!doc.includes(claim)) throw new Error(`claim no longer present in ${url}: ${claim}`);
}

const factoryAbi = parseAbi([
  "function getPerpPoolStatuses() view returns ((address perpPool, address baseToken, bool restricted)[])",
]);
const capAbi = parseAbi(["function getMaxBuilderFeeBpsTimes1k() view returns (uint256)"]);

const factory = SOMNIA_HIDEKI_TESTNET_ADDRESSES.perpPoolFactory as Address;
const markets = createMarkets({ withSigner: false });
const client = markets.client;
const viem = client.getViemClient();
const blockNumber = await viem.getBlockNumber();

const statuses = await viem.readContract({
  address: factory,
  abi: factoryAbi,
  functionName: "getPerpPoolStatuses",
  blockNumber,
});
const spotMarkets = await client.listSpotMarkets({ limit: 100 });

async function readCap(pool: Address): Promise<bigint> {
  return viem.readContract({
    address: pool,
    abi: capAbi,
    functionName: "getMaxBuilderFeeBpsTimes1k",
    blockNumber,
  });
}

const perpCaps = await Promise.all(
  statuses.map(async (status) => ({ pool: status.perpPool, cap: (await readCap(status.perpPool)).toString() })),
);
const spotPools = [...new Set(spotMarkets.map((market) => market.poolAddress as Address))];
const spotCaps = await Promise.all(
  spotPools.map(async (pool) => ({ pool, cap: (await readCap(pool)).toString() })),
);

const rows = [
  ...perpCaps.map((row) => ({ ...row, kind: "perp" })),
  ...spotCaps.map((row) => ({ ...row, kind: "spot" })),
];
function capCounts(source: { cap: string }[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of source) result[row.cap] = (result[row.cap] ?? 0) + 1;
  return result;
}
const counts = capCounts(rows);
const everyPoolIs100k = rows.every((row) => row.cap === "100000");
const everyPoolIsZero = rows.every((row) => row.cap === "0");
const perpAll10k = perpCaps.every((row) => row.cap === "10000");
const spotAll100k = spotCaps.every((row) => row.cap === "100000");

console.log(`docs ${ERRORS_URL}`);
console.log(`  "${errorsClaim}"`);
console.log(`docs ${FUNCTIONS_URL}`);
console.log(`  "${functionsClaim}"`);
console.log(`  "${functionsZeroClaim}"`);
console.log(`\nchain 50383, block ${blockNumber}`);
console.log(`perp pools: ${perpCaps.length}, caps ${JSON.stringify(capCounts(perpCaps))}`);
console.log(`spot pools: ${spotCaps.length}, caps ${JSON.stringify(capCounts(spotCaps))}`);
console.log(`\nall ${rows.length} testnet pools cap at 100000: ${everyPoolIs100k}`);
console.log(`all ${rows.length} testnet pools cap at 0:      ${everyPoolIsZero}`);
console.log(`perp pools all cap at 10000:               ${perpAll10k}`);
console.log(`spot pools all cap at 100000:              ${spotAll100k}`);

const snapshot = {
  capturedAt: new Date().toISOString(),
  chainId: 50383,
  blockNumber: blockNumber.toString(),
  factory,
  docs: {
    errorsUrl: ERRORS_URL,
    functionsUrl: FUNCTIONS_URL,
    quotes: { errors: errorsClaim, everyPool: functionsClaim, testnetZero: functionsZeroClaim },
  },
  chain: {
    perp: perpCaps,
    spot: spotCaps,
    capCounts: counts,
  },
  summary: {
    pools: rows.length,
    everyPoolIs100k,
    everyPoolIsZero,
    perpAll10k,
    spotAll100k,
    perpPoolsViolatingEveryPoolClaim: perpCaps.filter((row) => row.cap !== "100000").length,
    poolsViolatingTestnetZeroClaim: rows.filter((row) => row.cap !== "0").length,
  },
};
writeFileSync("evidence/docs-builder-cap.json", JSON.stringify(snapshot, null, 2));
console.log("\nWrote evidence/docs-builder-cap.json");
process.exit(0);
