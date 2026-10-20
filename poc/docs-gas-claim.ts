// Docs say perp-pool transactions cost 0.0003-0.003 STT and that successful
// placeOrderFor txs used up to about 1.56M gas. Re-read pinned successful
// placeOrderFor receipts and compare. Read-only: no signer, no writes.
import { writeFileSync } from "node:fs";
import { createPublicClient, formatEther, formatGwei, http } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { createMarkets } from "../src/sdk.js";
import { config } from "../src/config.js";

const DOCS_URL = "https://app.testnet.dreamdex.io/docs/developers/perps-testnet";
const DOCS_COST_QUOTE =
  "Transactions to perp pools measured on testnet cost between 0.0003 and 0.003 STT each.";
const DOCS_GAS_QUOTE =
  "Successful placeOrderFor transactions used up to about 1.56M gas; recommended limit 10,000,000.";
const COST_MIN = 300_000_000_000_000n; // 0.0003 STT
const COST_MAX = 3_000_000_000_000_000n; // 0.003 STT
const GAS_MAX = 1_560_000n;
const PLACE_ORDER_FOR = "0x80054449";

const TX_HASHES = [
  "0x8d77ce0a697997d99b4bb3f87c9b3ce722f78c13ed8b6ff24963a4974c938cc0",
  "0x6ba52e192185afe272c79680537c68b184431ff8f4abf3e74daebeb8465567ac",
  "0xd1b752fb21a8119e6c57900b226d1463ff081d2d83372871df3c633e1aa1b877",
  "0xabfb5acfd5ce13721feeaa46dd16db55ee13172aaecad272eb9365e2af7166bb",
] as const;

const markets = createMarkets({ withSigner: false });
const pub = createPublicClient({ chain: hidekiTestnet, transport: http(config.rpcUrl) });
const list = await markets.client.listPerpMarkets({ limit: 100 });
const poolByAddress = new Map(
  list.map((m) => [m.poolAddress?.toLowerCase(), m.baseSymbol ?? "?"] as const),
);

const rows = [];
for (const hash of TX_HASHES) {
  const receipt = await pub.getTransactionReceipt({ hash });
  const tx = await pub.getTransaction({ hash });
  const pool = tx.to?.toLowerCase() ?? "";
  const symbol = poolByAddress.get(pool);
  if (symbol === undefined) throw new Error(`${hash}: not sent to a listed perp pool`);
  if (receipt.status !== "success") throw new Error(`${hash}: not successful`);
  if (tx.input.slice(0, 10) !== PLACE_ORDER_FOR) throw new Error(`${hash}: not placeOrderFor`);
  const fee = receipt.gasUsed * receipt.effectiveGasPrice;
  rows.push({
    hash,
    symbol,
    pool: tx.to,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    gasPriceGwei: formatGwei(receipt.effectiveGasPrice),
    feeWei: fee.toString(),
    feeStt: formatEther(fee),
    feeAboveDocsMax: fee > COST_MAX,
    gasAboveDocsMax: receipt.gasUsed > GAS_MAX,
  });
}

console.log(`chain 50383, ${rows.length} pinned successful placeOrderFor txs`);
console.log(
  "symbol".padEnd(8),
  "block".padEnd(10),
  "gasUsed".padEnd(10),
  "gwei".padEnd(6),
  "fee STT".padEnd(14),
  ">docs gas".padEnd(10),
  ">docs fee",
);
for (const r of rows) {
  console.log(
    r.symbol.padEnd(8),
    r.blockNumber.padEnd(10),
    r.gasUsed.padEnd(10),
    r.gasPriceGwei.padEnd(6),
    r.feeStt.padEnd(14),
    String(r.gasAboveDocsMax).padEnd(10),
    r.feeAboveDocsMax,
  );
}

const gasAbove = rows.filter((r) => r.gasAboveDocsMax).length;
const feeAbove = rows.filter((r) => r.feeAboveDocsMax).length;
const maxGas = rows.reduce((a, r) => (BigInt(r.gasUsed) > BigInt(a.gasUsed) ? r : a));
const maxFee = rows.reduce((a, r) => (BigInt(r.feeWei) > BigInt(a.feeWei) ? r : a));

console.log(`\ndocs gas ceiling ${GAS_MAX} (about 1.56M); txs above it: ${gasAbove}/${rows.length}`);
console.log(`docs fee range 0.0003-0.003 STT; txs above it: ${feeAbove}/${rows.length}`);
console.log(`highest gas: ${maxGas.symbol} ${maxGas.hash} ${maxGas.gasUsed}`);
console.log(`highest fee: ${maxFee.symbol} ${maxFee.hash} ${maxFee.feeStt} STT`);
console.log(`docs cost claim holds for every tx: ${feeAbove === 0}`);
console.log(`docs gas claim holds for every tx: ${gasAbove === 0}`);

const snapshot = {
  capturedAt: new Date().toISOString(),
  chainId: 50383,
  docs: {
    url: DOCS_URL,
    costQuote: DOCS_COST_QUOTE,
    gasQuote: DOCS_GAS_QUOTE,
    documentedCostRangeStt: ["0.0003", "0.003"],
    documentedGasCeiling: "1560000",
  },
  rows,
  summary: {
    transactions: rows.length,
    aboveGasCeiling: gasAbove,
    aboveCostRange: feeAbove,
    highestGas: { hash: maxGas.hash, symbol: maxGas.symbol, gasUsed: maxGas.gasUsed },
    highestFee: { hash: maxFee.hash, symbol: maxFee.symbol, feeStt: maxFee.feeStt },
    costClaimHolds: feeAbove === 0,
    gasClaimHolds: gasAbove === 0,
  },
};
writeFileSync("evidence/docs-gas-claim.json", JSON.stringify(snapshot, null, 2));
console.log("\nWrote evidence/docs-gas-claim.json");
process.exit(0);
