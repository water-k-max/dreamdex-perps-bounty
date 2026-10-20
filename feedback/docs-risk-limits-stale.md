# Perps risk-limit docs are stale: OI caps are 2x–4x higher on-chain and the position-cap rule no longer matches

Severity: normal
Area: docs

## Steps to reproduce

1. From a clean checkout, install dependencies and run the read-only POC:
   ```bash
   export PATH=/home/user/.local/share/pnpm/bin:$PATH
   pnpm install
   pnpm poc:risk-limits
   ```
2. The POC embeds the "Open interest cap" column of the market table (captured 2026-10-20), then reads `getPerpPoolParameters()` for all 21 pools at the current block and at block 28000000.
3. Open the perps developer docs and compare the table and the "Position cap" paragraph:
   https://app.testnet.dreamdex.io/docs/developers/perps-testnet

## Expected

The market table's "Open interest cap" column should match each pool's on-chain `maxOpenInterest`.

The page also states:

> Each account has a position cap per market, a tenth of the market's open interest cap on most markets. An order that would take the account past it reverts with `MaxPositionSizeExceeded()` (`0x714b36d6`)

So `maxPositionSize` should be one tenth of `maxOpenInterest` on most markets, and a trader should be able to derive the per-account cap from the table.

## Actual

### The table is a pre-increase snapshot

All 21 table values match `maxOpenInterest` exactly at block 28000000, so they came from the contract, not from a typo or a different unit. At the current block only TAO still matches:

| Markets | Docs value vs on-chain OI cap |
| --- | --- |
| BTC, ETH, HYPE, SOL | on-chain cap is **2x** the table value |
| ZRO, LIT, VVV, 1000PEPE, PUMP, ZEC, WLD, NEAR, XLM, AVAX, LINK, SUI, ADA, BNB, DOGE, XRP | on-chain cap is **4x** the table value |
| TAO | unchanged |

The two runs at blocks 28631648 and 28631911 both report `docs OI cap matches chain now: 1/21`.

### The position-cap rule does not match either denominator

Against the current on-chain OI cap, the per-account cap is 2.49%–25.00% of open interest; **zero** of 21 markets use the documented 10%. The ratios are:

| cap / OI | Markets |
| --- | --- |
| 2.49–2.50% | ZRO, LIT, VVV, 1000PEPE, PUMP, WLD |
| 4.99–5.04% | NEAR, XLM, AVAX, LINK, SUI, ADA, BNB, DOGE, XRP, HYPE, SOL, ETH |
| 9.99% | TAO |
| 20.25% | BTC |
| 25.00% | ZEC |

The table values do not rescue the claim either: because they are stale, the real per-account cap is larger than a tenth of the table value on most markets, not equal to it.

Concrete example, BTC:

- Table open interest cap: 246.81545 BTC
- Current on-chain `maxOpenInterest`: 493.6309 BTC
- Documented per-account cap if you apply "a tenth" to the table: 24.681545 BTC
- Documented per-account cap if you apply "a tenth" to current OI: 49.36309 BTC
- Actual on-chain `maxPositionSize`: **100 BTC**

A trader or risk tool sizing from either documented number is off by 2x–4x. On the six ~2.49% markets the direction reverses: the documented tenth of current OI is larger than the real cap, so an order sized that way reverts with `MaxPositionSizeExceeded()`.

## Evidence

Two independent runs, identical results:

```text
chain 50383, current block 28631648, docs-snapshot block 28000000
symbol      docs OI            OI @snapshot       OI now             now/docs  cap now          cap/OI
ZRO         250599.5           250599.5           1002398            4x        25059.9          2.49%
LIT         138896.6           138896.6           555586.4           4x        13889.6          2.49%
VVV         21786.14           21786.14           87144.56           4x        2178.61          2.49%
1000PEPE    130285600          130285600          521142400          4x        13028500         2.49%
PUMP        87993700           87993700           351974800          4x        8799300          2.49%
ZEC         420                420                1680               4x        420              25.00%
TAO         2185.491           2185.491           2185.491           1x        218.549          9.99%
WLD         1264000            1264000            5056000            4x        126400           2.50%
NEAR        250410             250410             1001640            4x        50000            4.99%
XLM         2677780            2677780            10711120           4x        535556           5.00%
AVAX        66672.2            66672.2            266688.8           4x        13334.4          4.99%
LINK        42643.6            42643.6            170574.4           4x        8528.6           4.99%
SUI         635009             635009             2540036            4x        127000           4.99%
ADA         2254678            2254678            9018712            4x        450934           4.99%
BNB         693.975            693.975            2775.9             4x        140              5.04%
DOGE        5613590            5613590            22454360           4x        1122700          4.99%
XRP         344632             344632             1378528            4x        68926.4          5.00%
HYPE        23812.72           23812.72           47625.44           2x        2381.27          4.99%
SOL         47654.44           47654.44           95308.88           2x        4765.44          4.99%
ETH         3995.6125          3995.6125          7991.225           2x        399.5612         4.99%
BTC         246.81545          246.81545          493.6309           2x        100              20.25%

markets: 21
docs OI cap matches chain at block 28000000: 21/21
docs OI cap matches chain now: 1/21
OI multiplier now (docs -> chain): {"4x":16,"1x":1,"2x":4}
cap is exactly one tenth of current OI cap: 0/21
docs claim ("a tenth ... on most markets") holds: false
```

The second run at block 28631911 printed the same values. Raw per-pool values, docs values, multiplier, and cap/OI bps: [`evidence/docs-risk-limits.json`](../evidence/docs-risk-limits.json).

Docs quote (fetched 2026-10-20):

> Each account has a position cap per market, a tenth of the market's open interest cap on most markets. An order that would take the account past it reverts with `MaxPositionSizeExceeded()` (`0x714b36d6`)

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Network: Somnia Tokyo / Hideki testnet, chain ID 50383
- RPC: `https://api.hideki2.infra.testnet.somnia.network`
- Wallet: `0xa796e1f8a7aECa35086EE56658A90573fBCB0c0b` (read-only POC; no signer, no transactions)
