// The SDK's own PERPS.md says testnet has 10 pools, four restricted SBTC* markets.
// Read-only: no signer, no writes. Every chain read is pinned to one block per network.
import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, http, parseAbi, type Address } from "viem";
import {
  SOMNIA_HIDEKI_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_ADDRESSES,
} from "@somnia-chain/markets-sdk";
import { hidekiTestnet, somniaShannon } from "@somnia-chain/markets-sdk/chains";
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

const deployments = [
  {
    label: "hideki",
    chainId: 50383,
    chain: hidekiTestnet,
    rpcUrl: config.rpcUrl,
    factory: SOMNIA_HIDEKI_TESTNET_ADDRESSES.perpPoolFactory as Address,
    sdk: true,
  },
  {
    label: "shannon",
    chainId: 50312,
    chain: somniaShannon,
    rpcUrl: somniaShannon.rpcUrls.default.http[0],
    factory: SOMNIA_TESTNET_ADDRESSES.perpPoolFactory as Address,
    sdk: false,
  },
] as const;

const markets = createMarkets({ withSigner: false });
const client = markets.client;

async function readDeployment(dep: (typeof deployments)[number]) {
  // Direct reads use HTTP so the POC does not depend on the SDK's WebSocket staying up.
  const viem = createPublicClient({ chain: dep.chain, transport: http(dep.rpcUrl) });
  const blockNumber = await viem.getBlockNumber();
  const [rawPools, statuses] = await Promise.all([
    viem.readContract({ address: dep.factory, abi: factoryAbi, functionName: "getPerpPools", blockNumber }),
    viem.readContract({ address: dep.factory, abi: factoryAbi, functionName: "getPerpPoolStatuses", blockNumber }),
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
  // in this range, and each row matches the raw reads above. The wrapper is bound to the
  // Hideki deployment, so only run it there.
  let sdk:
    | {
        blockRange: [string, string];
        count: number;
        restrictedCount: number;
        tradeableCount: number;
        undeterminedCount: number;
      }
    | undefined;
  if (dep.sdk) {
    const sdkBlockBefore = await viem.getBlockNumber();
    const sdkStatuses = await client.listPerpPoolStatuses({ factory: dep.factory });
    const sdkBlockAfter = await viem.getBlockNumber();
    sdk = {
      blockRange: [sdkBlockBefore.toString(), sdkBlockAfter.toString()],
      count: sdkStatuses.length,
      restrictedCount: sdkStatuses.filter((status) => status.restricted).length,
      tradeableCount: sdkStatuses.filter((status) => status.tradeable).length,
      undeterminedCount: sdkStatuses.filter((status) => status.tradeable === null).length,
    };
  }

  const restricted = rows.filter((row) => row.restricted);
  const registered = rows.filter((row) => row.registered);
  const tradeable = rows.filter((row) => row.tradeable);
  const sbtc = rows.filter((row) => row.symbol?.startsWith("SBTC"));
  const swbtc = rows.filter((row) => row.symbol?.startsWith("SWBTC"));

  return {
    label: dep.label,
    chainId: dep.chainId,
    rpcUrl: dep.rpcUrl,
    blockNumber: blockNumber.toString(),
    factory: dep.factory,
    rawGetPerpPoolsCount: rawPools.length,
    rows,
    restricted,
    registered,
    tradeable,
    sbtc,
    swbtc,
    sdk,
  };
}

const results = [];
for (const dep of deployments) {
  results.push(await readDeployment(dep));
}

const sdkPkg = JSON.parse(readFileSync(SDK_PACKAGE, "utf8")) as { version: string };
const docsPools = Number(quote.match(/has (\d+) pools/)?.[1]);
const docsRestricted = 4;
const introMarkets = ["BTC", "ETH"];

console.log(`SDK ${sdkPkg.version} ${DOC_PATH}:${introLineIndex + 1}`);
console.log(`  "${introQuote}"`);
console.log(`${DOC_PATH}:${docLineIndex + 1}`);
console.log(`  "${quote}"`);

for (const r of results) {
  console.log(`\nchain ${r.chainId} (${r.label}), block ${r.blockNumber}`);
  console.log(`factory ${r.factory}`);
  console.log(`raw getPerpPools(): ${r.rawGetPerpPoolsCount}`);
  console.log(
    `getPerpPoolStatuses(): ${r.rows.length} pools, ${r.restricted.length} restricted, ` +
      `${r.registered.length} registered, ${r.tradeable.length} tradeable`,
  );
  console.log(
    `SBTC* base tokens: ${r.sbtc.length}; SWBTC* base tokens: ${r.swbtc.length} ` +
      `(${r.swbtc.map((row) => row.symbol).join(", ") || "none"})`,
  );
  console.log("\nsymbol".padEnd(12), "restricted".padEnd(11), "registered".padEnd(11), "tradeable");
  for (const row of r.rows) {
    console.log(
      String(row.symbol ?? "?").padEnd(12),
      String(row.restricted).padEnd(11),
      String(row.registered).padEnd(11),
      String(row.tradeable),
    );
  }
  if (r.sdk) {
    console.log(
      `\nSDK listPerpPoolStatuses(): ${r.sdk.count} pools, ${r.sdk.restrictedCount} restricted, ` +
        `${r.sdk.tradeableCount} tradeable, ${r.sdk.undeterminedCount} undetermined ` +
        `(blocks ${r.sdk.blockRange[0]}..${r.sdk.blockRange[1]})`,
    );
  }
  const introMatches =
    r.rows.length === introMarkets.length &&
    introMarkets.every((symbol) => r.rows.some((row) => row.symbol === symbol));
  const matches = docsPools === r.rows.length && docsRestricted === r.restricted.length;
  console.log(`docs intro names ${introMarkets.length} markets vs chain ${r.rows.length}; intro matches: ${introMatches}`);
  console.log(
    `docs pools ${docsPools} vs chain ${r.rows.length}; ` +
      `docs restricted ${docsRestricted} vs chain ${r.restricted.length}`,
  );
  console.log(`=> docs match ${r.label}: ${matches}`);
  Object.assign(r, { introMatches, matches });
}

const snapshot = {
  capturedAt: new Date().toISOString(),
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
  deployments: results.map((r) => ({
    label: r.label,
    chainId: r.chainId,
    rpcUrl: r.rpcUrl,
    blockNumber: r.blockNumber,
    factory: r.factory,
    rawGetPerpPoolsCount: r.rawGetPerpPoolsCount,
    chain: {
      statusesCount: r.rows.length,
      restrictedCount: r.restricted.length,
      registeredCount: r.registered.length,
      tradeableCount: r.tradeable.length,
      sbtcCount: r.sbtc.length,
      sbtcSymbols: r.sbtc.map((row) => row.symbol),
      swbtcCount: r.swbtc.length,
      swbtcSymbols: r.swbtc.map((row) => row.symbol),
      rows: r.rows,
    },
    sdkListPerpPoolStatuses: r.sdk,
    summary: {
      matches: r.matches,
      introMatches: r.introMatches,
      liveMarketCount: r.rows.length,
      poolCountDelta: r.rows.length - docsPools,
      restrictedCountDelta: r.restricted.length - docsRestricted,
    },
  })),
};
writeFileSync("evidence/docs-sdk-pool-inventory.json", JSON.stringify(snapshot, null, 2));
console.log("\nWrote evidence/docs-sdk-pool-inventory.json");
process.exit(0);
