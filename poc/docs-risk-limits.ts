// The docs market table lists an open interest cap per market, and the same
// page says each account's position cap is a tenth of it on most markets.
// Compare both claims with pool parameters now and at the block the table
// values match. Read-only: no signer, no writes.
import { writeFileSync } from "node:fs";
import { createPublicClient, formatUnits, http, parseAbi, parseUnits } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { createMarkets } from "../src/sdk.js";
import { config } from "../src/config.js";

const DOCS_URL = "https://app.testnet.dreamdex.io/docs/developers/perps-testnet";
const DOCS_QUOTE =
  "Each account has a position cap per market, a tenth of the market's open interest cap on most markets. An order that would take the account past it reverts with MaxPositionSizeExceeded() (0x714b36d6); getMaxPerpOrderSize reports the cap as maxPositionSize.";

// "Open interest cap" column, fetched 2026-10-20.
const DOCS_OI_CAP: Record<string, string> = {
  ZRO: "250599.5",
  LIT: "138896.6",
  VVV: "21786.14",
  "1000PEPE": "130285600",
  PUMP: "87993700",
  ZEC: "420",
  TAO: "2185.491",
  WLD: "1264000",
  NEAR: "250410",
  XLM: "2677780",
  AVAX: "66672.2",
  LINK: "42643.6",
  SUI: "635009",
  ADA: "2254678",
  BNB: "693.975",
  DOGE: "5613590",
  XRP: "344632",
  HYPE: "23812.72",
  SOL: "47654.44",
  ETH: "3995.6125",
  BTC: "246.81545",
};

// Every docs value matched getPerpPoolParameters().maxOpenInterest here, which
// is what identifies the table as a pre-increase snapshot rather than a typo.
const DOCS_SNAPSHOT_BLOCK = 28_000_000n;

const poolAbi = parseAbi([
  "function getPerpPoolParameters() view returns ((uint256 initialMarginBps, uint256 maintenanceMarginBps, uint256 closeOutMarginBps, uint256 maxOpenInterest, uint256 maxPositionSize, uint256 takerFeeBpsTimes1k, int256 makerFeeBpsTimes1k, uint256 insuranceFundShareBps))",
]);

const markets = createMarkets({ withSigner: false });
const pub = createPublicClient({ chain: hidekiTestnet, transport: http(config.rpcUrl) });
const list = await markets.client.listPerpMarkets({ limit: 100 });
const blockNumber = await pub.getBlockNumber();

const fmt = (value: bigint, decimals: number) => {
  const s = formatUnits(value, decimals);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
};

const rows = [];
for (const market of list) {
  const symbol = market.baseSymbol ?? "?";
  const decimals = Number(market.baseDecimals);
  const docsValue = DOCS_OI_CAP[symbol];
  if (docsValue === undefined) throw new Error(`no docs OI cap for ${symbol}`);
  const docsRaw = parseUnits(docsValue.replace(/,/g, ""), decimals);

  const read = (blockNumber: bigint) =>
    pub.readContract({
      address: market.poolAddress as `0x${string}`,
      abi: poolAbi,
      functionName: "getPerpPoolParameters",
      blockNumber,
    });
  const snapshot = await read(DOCS_SNAPSHOT_BLOCK);
  const current = await read(blockNumber);

  const snapshotOi = BigInt(snapshot.maxOpenInterest);
  const currentOi = BigInt(current.maxOpenInterest);
  const currentCap = BigInt(current.maxPositionSize);
  const multiplier = Number((currentOi * 100n) / docsRaw) / 100;
  const capOfOiBps = Number((currentCap * 10_000n) / currentOi);

  rows.push({
    symbol,
    pool: market.poolAddress,
    decimals,
    docsOiCap: docsValue,
    snapshotOi: fmt(snapshotOi, decimals),
    currentOi: fmt(currentOi, decimals),
    oiMultiplier: multiplier,
    currentPositionCap: fmt(currentCap, decimals),
    capOfOiBps,
    docsMatchesSnapshot: docsRaw === snapshotOi,
    docsMatchesCurrent: docsRaw === currentOi,
    capIsTenthOfCurrentOi: currentCap * 10n === currentOi,
  });
}

console.log(`chain 50383, current block ${blockNumber}, docs-snapshot block ${DOCS_SNAPSHOT_BLOCK}`);
console.log(
  "symbol".padEnd(11),
  "docs OI".padEnd(18),
  "OI @snapshot".padEnd(18),
  "OI now".padEnd(18),
  "now/docs".padEnd(9),
  "cap now".padEnd(16),
  "cap/OI",
);
for (const r of rows) {
  console.log(
    r.symbol.padEnd(11),
    r.docsOiCap.padEnd(18),
    r.snapshotOi.padEnd(18),
    r.currentOi.padEnd(18),
    `${r.oiMultiplier}x`.padEnd(9),
    r.currentPositionCap.padEnd(16),
    `${(r.capOfOiBps / 100).toFixed(2)}%`,
  );
}

const snapshotMatches = rows.filter((r) => r.docsMatchesSnapshot).length;
const currentMatches = rows.filter((r) => r.docsMatchesCurrent).length;
const tenth = rows.filter((r) => r.capIsTenthOfCurrentOi).length;
const multipliers = rows.reduce<Record<string, number>>((acc, r) => {
  const key = `${r.oiMultiplier}x`;
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

console.log(`\nmarkets: ${rows.length}`);
console.log(`docs OI cap matches chain at block ${DOCS_SNAPSHOT_BLOCK}: ${snapshotMatches}/${rows.length}`);
console.log(`docs OI cap matches chain now: ${currentMatches}/${rows.length}`);
console.log(`OI multiplier now (docs -> chain): ${JSON.stringify(multipliers)}`);
console.log(`cap is exactly one tenth of current OI cap: ${tenth}/${rows.length}`);
console.log(`docs claim ("a tenth ... on most markets") holds: ${tenth > rows.length / 2}`);

const snapshot = {
  capturedAt: new Date().toISOString(),
  chainId: 50383,
  blockNumber: blockNumber.toString(),
  docsSnapshotBlock: DOCS_SNAPSHOT_BLOCK.toString(),
  docs: {
    url: DOCS_URL,
    tableFetchedAt: "2026-10-20",
    rowQuote:
      "Each account has a position cap per market, a tenth of the market's open interest cap on most markets.",
    quote: DOCS_QUOTE,
  },
  rows,
  summary: {
    markets: rows.length,
    docsMatchesSnapshot: snapshotMatches,
    docsMatchesCurrent: currentMatches,
    oiMultipliers: multipliers,
    capExactlyOneTenthOfCurrentOi: tenth,
    docsClaimHolds: tenth > rows.length / 2,
  },
};
writeFileSync("evidence/docs-risk-limits.json", JSON.stringify(snapshot, null, 2));
console.log("\nWrote evidence/docs-risk-limits.json");
process.exit(0);
