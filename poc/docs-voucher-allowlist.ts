// Docs say six markets cannot use Paper USDso; the MarginBank's allowlist says all 21 can.
// Read-only: no signer, no writes.
import { writeFileSync } from "node:fs";
import { parseAbi, type Address } from "viem";
import { createMarkets } from "../src/sdk.js";

const DOCS_URL = "https://app.testnet.dreamdex.io/docs/trading/perps-testnet/margin-and-liquidations";
const MARKET_TABLE_URL = "https://app.testnet.dreamdex.io/docs/developers/perps-testnet";

// Transcribed from the "Paper USDso" column of the market table on 2026-10-20.
const DOCS_SAYS_NO = new Set(["1000PEPE", "LIT", "PUMP", "VVV", "ZEC", "ZRO"]);

const marginBankAbi = parseAbi([
  "function isVoucherMarketAllowed(address perpPool) view returns (bool)",
]);

const markets = createMarkets({ withSigner: false });
const client = markets.client;
const viem = client.getViemClient();
const list = await client.listPerpMarkets({ limit: 100 });
const blockNumber = await viem.getBlockNumber();

const marginBanks = [...new Set(list.map((m) => m.marginBank))];
if (marginBanks.length !== 1) {
  throw new Error(`expected one margin bank, got ${marginBanks.join(", ")}`);
}
const marginBank = marginBanks[0] as Address;

const rows = [];
for (const market of list) {
  const allowed = await viem.readContract({
    address: marginBank,
    abi: marginBankAbi,
    functionName: "isVoucherMarketAllowed",
    args: [market.poolAddress as Address],
    blockNumber,
  });
  const symbol = market.baseSymbol ?? "?";
  const docsAllows = !DOCS_SAYS_NO.has(symbol);
  rows.push({
    symbol,
    pool: market.poolAddress,
    docsPaperUsdso: docsAllows ? "Yes" : "No",
    chainIsVoucherMarketAllowed: allowed,
    matches: docsAllows === allowed,
  });
}

console.log(`chain 50383, block ${blockNumber}`);
console.log(`MarginBank ${marginBank}`);
console.log(`markets ${rows.length}`);
console.log("symbol".padEnd(12), "docs".padEnd(6), "chain".padEnd(6), "match");
for (const row of rows) {
  console.log(
    String(row.symbol).padEnd(12),
    row.docsPaperUsdso.padEnd(6),
    String(row.chainIsVoucherMarketAllowed).padEnd(6),
    row.matches ? "yes" : "NO",
  );
}

const docsNoButChainYes = rows.filter((r) => DOCS_SAYS_NO.has(r.symbol) && r.chainIsVoucherMarketAllowed);
const mismatches = rows.filter((r) => !r.matches);
console.log(`\ndocs "No" but chain true: ${docsNoButChainYes.length}`);
console.log(`mismatches: ${mismatches.length}`);

const snapshot = {
  capturedAt: new Date().toISOString(),
  chainId: 50383,
  blockNumber: blockNumber.toString(),
  marginBank,
  docs: {
    marketTableUrl: MARKET_TABLE_URL,
    marginAndLiquidationsUrl: DOCS_URL,
    quote:
      "You can open or increase positions only in the markets marked Yes under Paper USDso in the market table. The six newest markets are not on that list.",
    paperUsdsoNo: [...DOCS_SAYS_NO],
  },
  rows,
  summary: { markets: rows.length, docsNoButChainTrue: docsNoButChainYes.length, mismatches: mismatches.length },
};
writeFileSync("evidence/docs-voucher-allowlist.json", JSON.stringify(snapshot, null, 2));
console.log("\nWrote evidence/docs-voucher-allowlist.json");
process.exit(0);
