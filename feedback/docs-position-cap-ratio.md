# Docs say the account position cap is a tenth of the OI cap on most markets, but no market uses that ratio

Severity: normal
Area: docs

## Steps to reproduce

1. From a clean checkout, install dependencies and run the read-only POC:
   ```bash
   export PATH=/home/user/.local/share/pnpm/bin:$PATH
   pnpm install
   pnpm poc:position-cap
   ```
2. The POC reads `getPerpPoolParameters()` from all 21 live pools at one pinned block and compares each pool's `maxPositionSize` (the per-account cap enforced by `MaxPositionSizeExceeded`) with its `maxOpenInterest`.
3. Open the perps developer docs and read the "Position cap" paragraph:
   https://app.testnet.dreamdex.io/docs/developers/perps-testnet

## Expected

The docs state:

> Each account has a position cap per market, a tenth of the market's open interest cap on most markets. An order that would take the account past it reverts with `MaxPositionSizeExceeded()` (`0x714b36d6`)

If that were true, most pools should have `maxPositionSize / maxOpenInterest` equal to 10% (1000 bps). A trader sizing an order from the documented rule would expect to be able to open up to one tenth of the market's open interest cap.

## Actual

Across all 21 live pools, **zero** have a position cap equal to one tenth of the open interest cap. The actual ratios cluster at roughly half the documented value (about 5%) and a quarter (about 2.49%), with three outliers:

| Observed cap / OI cap | Markets |
| --- | --- |
| 2.49–2.50% | ZRO, LIT, VVV, 1000PEPE, PUMP, WLD (6) |
| 4.99–5.04% | NEAR, XLM, AVAX, LINK, SUI, ADA, BNB, DOGE, XRP, HYPE, SOL, ETH (12) |
| 9.99% | TAO (1) |
| 20.25% | BTC (1) |
| 25.00% | ZEC (1) |

For the twelve most common markets the per-account cap is half of what the docs imply; for the six at ~2.5% it is a quarter. A trader who computes a position size as "a tenth of the market OI cap" will exceed the real cap on 20 of 21 markets and receive `MaxPositionSizeExceeded()` (0x714b36d6), despite following the docs.

The docs sentence is also internally inconsistent with the numbers: the phrase "on most markets" implies an exception set, but 10% is not the ratio on *any* market today.

The same mismatch is visible through the SDK: `getMaxPerpOrderSize` reports the pool's `maxPositionSize` as the per-account cap, matching the values above.

## Evidence

Two independent POC runs, each at a different block:

- Run 1, block 28626082: 21 markets, `cap is exactly one tenth of OI cap: 0`
- Run 2, block 28626602: 21 markets, `cap is exactly one tenth of OI cap: 0`

Run 2 output:

```text
chain 50383, block 28626602
symbol       maxPosition              maxOpenInterest          cap/OI
ZRO          25059900000000000000000  1002398000000000000000000 2.49%
LIT          13889600000000000000000  555586400000000000000000 2.49%
VVV          2178610000000000000000   87144560000000000000000  2.49%
1000PEPE     13028500000000000000000000 521142400000000000000000000 2.49%
PUMP         8799300000000            351974800000000          2.49%
ZEC          42000000000              168000000000             25.00%
TAO          218549000000             2185491000000            9.99%
WLD          126400000000000000000000 5056000000000000000000000 2.50%
NEAR         50000000000000000000000000000 1001640000000000000000000000000 4.99%
XLM          5355560000000            107111200000000          5.00%
AVAX         13334400000000000000000  266688800000000000000000 4.99%
LINK         8528600000000000000000   170574400000000000000000 4.99%
SUI          127000000000000          2540036000000000         4.99%
ADA          450934000000             9018712000000            4.99%
BNB          140000000000000000000    2775900000000000000000   5.04%
DOGE         112270000000000          2245436000000000         4.99%
XRP          68926400000              1378528000000            5.00%
HYPE         2381270000               47625440000              4.99%
SOL          4765440000000            95308880000000           4.99%
ETH          399561200000000000000    7991225000000000000000   4.99%
BTC          10000000000              49363090000              20.25%

markets: 21
cap is exactly one tenth of OI cap: 0
docs claim ("a tenth ... on most markets") holds: false
```

Raw per-pool values, pool addresses, and computed bps: [`evidence/docs-position-cap.json`](../evidence/docs-position-cap.json).

Docs quote (fetched 2026-10-20):

> Each account has a position cap per market, a tenth of the market's open interest cap on most markets. An order that would take the account past it reverts with `MaxPositionSizeExceeded()` (`0x714b36d6`)

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Network: Somnia Tokyo / Hideki testnet, chain ID 50383
- RPC: `https://api.hideki2.infra.testnet.somnia.network`
- Wallet: `0xa796e1f8a7aECa35086EE56658A90573fBCB0c0b` (read-only POC; no signer, no transactions)
