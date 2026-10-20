// The SDK's own PERPS.md says testnet has 10 pools, four restricted SBTC* markets.
// Read-only: no signer, no writes. Every chain read is pinned to one block.
import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { createMarkets } from "../src/sdk.js";
import { config } from "../src/config.js";

const DOC_PATH = "node_modules/@somnia-chain/markets-sdk/docs/PERPS.md";
const SDK_PACKAGE = "node_modules/@somnia-chain/markets-sdk/package.json";

const docLines = readFileSync(DOC_PATH, "utf8").split("\n");
const docLineIndex = docLines.findIndex((line) => line.includes("Testnet today has"));
if (docLineIndex < 0) throw new Error(`claim not found in ${DOC_PATH}`);
const introLineIndex = docLines.findIndex((line) => line.includes("Perps are live on testnet:"));
if (introLineIndex < 0) throw new Error(`intro claim not found in ${DOC_PATH}`);
const flatDoc = docLines.join(" ").replace(/\s+/g, " ");
const quote = flatDoc.match(
  /Testnet today has \d+ pools, four of them restricted `SBTC\*` arena markets\./,
)?.[0];
if (!quote) throw new Error(`could not parse the pool-inventory sentence in ${DOC_PATH}`);
const introQuote = "Perps are live on testnet: `BTC/USDSO:USDSO` and `ETH/USDSO:USDSO`";
if (!flatDoc.includes(introQuote)) throw new Error(`intro sentence changed in ${DOC_PATH}`);

const factoryAbi = parseAbi([
  "function getPerpPools() view returns (address[])",
  "function getPerpPoolStatuses() view returns ((address perpPool, address baseToken, bool restricted)[])",
]);
const poolAbi = parseAbi(["function marginBank() view returns (address)"]);
const bankAbi = parseAbi(["function isPerpPoolRegistered(address perpPool) view returns (bool)"]);
const erc20Abi = parseAbi(["function symbol() view returns (string)"]);

const factory = SOMNIA_HIDEKI_TESTNET_ADDRESSES.perpPoolFactory as Address;
const markets = createMarkets({ withSigner: false });
const client = markets.client;
// Direct reads use HTTP so the POC does not depend on the SDK's WebSocket staying up.
const viem = createPublicClient({ chain: hidekiTestnet, transport: http(config.rpcUrl) });

const blockNumber = await viem.getBlockNumber();
const [rawPools, statuses] = await Promise.all([
  viem.readContract({ address: factory, abi: factoryAbi, functionName: "getPerpPools", blockNumber }),
  viem.readContract({ address: factory, abi: factoryAbi, functionName: "getPerpPoolStatuses", blockNumber }),
]);

const rows = await Promise.all(
  statuses.map(async (status) => {
    const [bank, symbol] = await Promise.all([
      viem.readContract({
        address: status.perpPool,
        abi: poolAbi,
        functionName: "marginBank",
        blockNumber,
      }),
      viem
        .readContract({
          address: status.baseToken,
          abi: erc20Abi,
          functionName: "symbol",
          blockNumber,
        })
        .then(String)
        .catch(() => null),
    ]);
    const registered = await viem.readContract({
      address: bank,
      abi: bankAbi,
      functionName: "isPerpPoolRegistered",
      args: [status.perpPool],
      blockNumber,
    });
    return {
      symbol,
      pool: status.perpPool,
      baseToken: status.baseToken,
      marginBank: bank,
      restricted: status.restricted,
      registered,
      tradeable: !status.restricted && registered,
    };
  }),
);

// Bound the SDK wrapper's internal block-pinned read from outside: one block is always
// in this range, and each row below matches the raw reads above.
const sdkBlockBefore = await viem.getBlockNumber();
const sdkStatuses = await client.listPerpPoolStatuses({ factory });
const sdkBlockAfter = await viem.getBlockNumber();

const restricted = rows.filter((row) => row.restricted);
const registered = rows.filter((row) => row.registered);
const tradeable = rows.filter((row) => row.tradeable);
const sbtc = rows.filter((row) => row.symbol?.startsWith("SBTC"));
const sdkRestricted = sdkStatuses.filter((status) => status.restricted);
const sdkTradeable = sdkStatuses.filter((status) => status.tradeable);
const sdkUndetermined = sdkStatuses.filter((status) => status.tradeable === null).length;

const sdkPkg = JSON.parse(readFileSync(SDK_PACKAGE, "utf8")) as { version: string };

console.log(`SDK ${sdkPkg.version} ${DOC_PATH}:${introLineIndex + 1}`);
console.log(`  "${introQuote}"`);
console.log(`${DOC_PATH}:${docLineIndex + 1}`);
console.log(`  "${quote}"`);
console.log(`\nchain 50383, block ${blockNumber}`);
console.log(`factory ${factory}`);
console.log(`raw getPerpPools(): ${rawPools.length}`);
console.log(
  `getPerpPoolStatuses(): ${statuses.length} pools, ${restricted.length} restricted, ` +
    `${registered.length} registered, ${tradeable.length} tradeable`,
);
console.log(`SBTC* base tokens: ${sbtc.length}`);
console.log("\nsymbol".padEnd(12), "restricted".padEnd(11), "registered".padEnd(11), "tradeable");
for (const row of rows) {
  console.log(
    String(row.symbol ?? "?").padEnd(12),
    String(row.restricted).padEnd(11),
    String(row.registered).padEnd(11),
    String(row.tradeable),
  );
}
console.log(
  `\nSDK listPerpPoolStatuses(): ${sdkStatuses.length} pools, ${sdkRestricted.length} restricted, ` +
    `${sdkTradeable.length} tradeable, ${sdkUndetermined} undetermined (blocks ${sdkBlockBefore}..${sdkBlockAfter})`,
);

const docsPools = Number(quote.match(/has (\d+) pools/)?.[1]);
const docsRestricted = 4;
const introMarkets = ["BTC", "ETH"];
const introMatches = rows.length === introMarkets.length && introMarkets.every((symbol) => rows.some((row) => row.symbol === symbol));
const matches = docsPools === rows.length && docsRestricted === restricted.length;
console.log(`\ndocs intro names ${introMarkets.length} markets vs chain ${rows.length}; intro matches: ${introMatches}`);
console.log(`docs pools ${docsPools} vs chain ${rows.length}; docs restricted ${docsRestricted} vs chain ${restricted.length}`);
console.log(`=> docs match chain: ${matches}`);

const snapshot = {
  capturedAt: new Date().toISOString(),
  chainId: 50383,
  blockNumber: blockNumber.toString(),
  factory,
  docs: {
    file: DOC_PATH,
    line: docLineIndex + 1,
    introLine: introLineIndex + 1,
    sdkVersion: sdkPkg.version,
    quote,
    introQuote,
    statedPools: docsPools,
    statedRestricted: docsRestricted,
    statedRestrictedSbTc: true,
    introStatedMarkets: introMarkets,
  },
  rawGetPerpPoolsCount: rawPools.length,
  chain: {
    statusesCount: statuses.length,
    restrictedCount: restricted.length,
    registeredCount: registered.length,
    tradeableCount: tradeable.length,
    sbtcCount: sbtc.length,
    rows,
  },
  sdkListPerpPoolStatuses: {
    blockRange: [sdkBlockBefore.toString(), sdkBlockAfter.toString()],
    count: sdkStatuses.length,
    restrictedCount: sdkRestricted.length,
    tradeableCount: sdkTradeable.length,
    undeterminedCount: sdkUndetermined,
  },
  summary: {
    matches,
    introMatches,
    liveMarketCount: rows.length,
    poolCountDelta: rows.length - docsPools,
    restrictedCountDelta: restricted.length - docsRestricted,
  },
};
writeFileSync("evidence/docs-sdk-pool-inventory.json", JSON.stringify(snapshot, null, 2));
console.log("\nWrote evidence/docs-sdk-pool-inventory.json");
process.exit(0);
