import { writeFileSync } from "node:fs";
import { createMarkets } from "./sdk.js";
import { config } from "./config.js";

const markets = createMarkets({ withSigner: false });
const account = config.walletAddress;
if (!account) throw new Error("WALLET_ADDRESS is required");

const list = await markets.client.listPerpMarkets({ limit: 100 });
const first = list[0];
if (!first) throw new Error("no perp markets");

const results: Record<string, unknown> = {};
async function probe(name: string, fn: () => Promise<unknown>) {
  const started = Date.now();
  try {
    const value = await fn();
    results[name] = { ok: true, ms: Date.now() - started, value: sanitize(value) };
    console.log(`OK   ${name} (${Date.now() - started}ms)`);
  } catch (error) {
    const e = error as Error & { name?: string; shortMessage?: string; cause?: unknown };
    results[name] = {
      ok: false,
      ms: Date.now() - started,
      error: { name: e.name, message: e.message, shortMessage: e.shortMessage },
    };
    console.log(`FAIL ${name}: ${e.name}: ${e.shortMessage ?? e.message}`);
  }
}

function sanitize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

await probe("getPerpPosition", () =>
  markets.client.getPerpPosition({ pool: first.poolAddress as `0x${string}`, marginBank: first.marginBank as `0x${string}`, account }),
);
await probe("getMarginAccount", () => markets.client.getMarginAccount(first.marginBank as `0x${string}`, account));
await probe("getAccountHealth", () => markets.client.getAccountHealth(first.marginBank as `0x${string}`, account));
await probe("getLiquidationPrice", () =>
  markets.client.getLiquidationPrice({ pool: first.poolAddress as `0x${string}`, marginBank: first.marginBank as `0x${string}`, account }),
);
await probe("listPerpPositions", () => markets.client.listPerpPositions(account));
await probe("listPerpPositionAnalytics", () =>
  markets.client.listPerpPositionAnalytics({ marginBank: first.marginBank as `0x${string}`, account }),
);
await probe("listPerpOrderRejections", () => markets.client.listPerpOrderRejections({ owner: account }));
await probe("listPerpOrderHistory", () => markets.client.listPerpOrderHistory(account));
await probe("getPerpPortfolio", () => markets.client.getPerpPortfolio(account));
await probe("listPerpStopOrders", () => markets.client.listPerpStopOrders({ account }));
await probe("getPerpVoucherCampaign", () => markets.client.getPerpVoucherCampaign(first.marginBank as `0x${string}`));
await probe("getPerpVoucherEligibility", () => markets.client.getPerpVoucherEligibility(first.marginBank as `0x${string}`, account));
await probe("getPerpVoucher", () => markets.client.getPerpVoucher(first.marginBank as `0x${string}`, account));
await probe("getPerpMainFunding", () => markets.client.getPerpMainFunding(first.marginBank as `0x${string}`, account));
await probe("quotePerpFundingPayer", () => markets.client.quotePerpFundingPayer(first.marginBank as `0x${string}`, account));
await probe("getPerpCollateralBasis", () => markets.client.getPerpCollateralBasis(first.marginBank as `0x${string}`, account));
await probe("getPerpWalletPullCapacity", () => markets.client.getPerpWalletPullCapacity(first.marginBank as `0x${string}`, account));
await probe("getPerpLinkedWalletRegistry", () => markets.client.getPerpLinkedWalletRegistry(first.marginBank as `0x${string}`));
await probe("tryGetPerpAccountEquity", () => markets.client.tryGetPerpAccountEquity(first.marginBank as `0x${string}`, account));
await probe("getPerpState", () => markets.client.getPerpState(first.poolAddress as `0x${string}`));
await probe("getPerpFeedStatus", () => markets.client.getPerpFeedStatus(first.poolAddress as `0x${string}`));
await probe("getPerpRiskParams", () => markets.client.getPerpRiskParams(first.poolAddress as `0x${string}`));
await probe("getPerpFundingPremium", () => markets.client.getPerpFundingPremium(first.poolAddress as `0x${string}`));
await probe("getMaxPerpOrderSize", () =>
  markets.client.getMaxPerpOrderSize({
    pool: first.poolAddress as `0x${string}`,
    marginBank: first.marginBank as `0x${string}`,
    account,
    isBid: true,
    price: BigInt(first.tickSize),
  }),
);
await probe("getPerpLeverage", () =>
  markets.client.getPerpLeverage({ pool: first.poolAddress as `0x${string}`, marginBank: first.marginBank as `0x${string}`, account }),
);
await probe("getBankruptcyPrice", () =>
  markets.client.getBankruptcyPrice({ pool: first.poolAddress as `0x${string}`, marginBank: first.marginBank as `0x${string}`, account }),
);
await probe("previewPerpClosePnl", () =>
  markets.client.previewPerpClosePnl({ pool: first.poolAddress as `0x${string}`, marginBank: first.marginBank as `0x${string}`, account }),
);
await probe("previewPerpLiquidationPrice", () =>
  markets.client.previewPerpLiquidationPrice({
    pool: first.poolAddress as `0x${string}`,
    marginBank: first.marginBank as `0x${string}`,
    account,
    isBid: true,
    quantity: BigInt(first.minQuantity),
    price: BigInt(first.tickSize),
  }),
);

console.log("\nWallet balances:");
console.log(JSON.stringify(results["getMarginAccount"] ?? null, null, 2).slice(0, 1200));

writeFileSync("evidence/read-surface.json", JSON.stringify({ capturedAt: new Date().toISOString(), account, results }, null, 2));
console.log("\nWrote evidence/read-surface.json");
process.exit(0);
