import { writeFileSync } from "node:fs";
import { createMarkets } from "./sdk.js";

const markets = createMarkets({ withSigner: false });
const list = await markets.client.listPerpMarkets({ limit: 100 });

console.log(`Live perp markets: ${list.length}`);
console.log(
  [
    "symbol".padEnd(12),
    "baseDp".padStart(6),
    "quoteDp".padStart(7),
    "tick".padEnd(14),
    "lot".padEnd(16),
    "minQty".padEnd(16),
    "IMbps".padStart(6),
    "stopRegistry",
  ].join(" "),
);

for (const market of list) {
  console.log(
    [
      (market.baseSymbol ?? "?").padEnd(12),
      String(market.baseDecimals).padStart(6),
      String(market.quoteDecimals).padStart(7),
      market.tickSize.padEnd(14),
      market.lotSize.padEnd(16),
      market.minQuantity.padEnd(16),
      String(market.initialMarginBps).padStart(6),
      market.stopRegistry ?? "none",
    ].join(" "),
  );
}

const first = list[0];
if (first) {
  const system = await markets.client.getPerpSystemConfig(first.marginBank);
  const campaign = await markets.client.getPerpVoucherCampaign(first.marginBank);
  console.log("\nPerp system config:");
  console.dir(system, { depth: 4 });
  console.log("\nVoucher campaign:");
  console.dir(campaign, { depth: 4 });
}

const snapshot = {
  capturedAt: new Date().toISOString(),
  chainId: 50383,
  markets: list,
};
writeFileSync("evidence/baseline-markets.json", JSON.stringify(snapshot, null, 2));
console.log("\nWrote evidence/baseline-markets.json");
process.exit(0);
