# Perps docs state a per-account position cap of one tenth of the market's OI cap; 0 of 21 markets match it, and the published OI table is a pre-increase snapshot

Severity: normal
Area: docs

## Steps to reproduce

1. From a clean checkout, install dependencies and run the read-only POC:
   ```bash
   export PATH=/home/user/.local/share/pnpm/bin:$PATH
   pnpm install
   pnpm poc:risk-limits
   ```
2. The POC embeds the "Open interest cap" column of the market table (captured 2026-10-20), then reads `getPerpPoolParameters()` for all 21 pools at the current block and at block 28000000, and computes each pool's `maxPositionSize` as a fraction of its `maxOpenInterest`.
3. Open the two pages that state the rule and publish the numbers:
   - the rule, "Common pitfalls" section: https://app.testnet.dreamdex.io/docs/developers/perps-testnet
   - the market table and the note under it, "Markets" section: https://app.testnet.dreamdex.io/docs/trading/perps-testnet

## Expected

Both pages state the same per-account rule. The developer page says:

> Each account has a position cap per market, a tenth of the market's open interest cap on most markets. An order that would take the account past it reverts with `MaxPositionSizeExceeded()` (`0x714b36d6`); `getMaxPerpOrderSize` reports the cap as `maxPositionSize`.

The note under the market table repeats it:

> The open interest cap is market-wide, across every account, and is held in the base asset. A single account is capped at a tenth of it on most markets.

So `maxPositionSize` should be one tenth of `maxOpenInterest` on most markets, and a trader should be able to derive the per-account cap from the published table.

The table itself carries a disclaimer — "These figures are read from the live markets and can be retuned at any time" — so this report is **not** a complaint that the cap numbers have moved. Retuning parameters is expected. The finding is about the *rule*, which is stated as a relationship between two on-chain parameters and is not qualified as tunable: whatever the caps are retuned to, the per-account cap should still come out at a tenth of the market cap on most markets. It does not, on any market.

## Actual

### The position-cap rule matches no market

Against the current on-chain OI cap, the per-account cap is 2.49%–25.00% of open interest. **Zero of 21** markets use the documented 10%, so "on most markets" is false for every market on the venue:

| cap / OI | Markets |
| --- | --- |
| 2.49–2.50% | ZRO, LIT, VVV, 1000PEPE, PUMP, WLD |
| 4.99–5.04% | NEAR, XLM, AVAX, LINK, SUI, ADA, BNB, DOGE, XRP, HYPE, SOL, ETH |
| 9.99% | TAO |
| 20.25% | BTC |
| 25.00% | ZEC |

Twelve markets sit at about 5% and six at about 2.5%, so the real rule looks like a per-market parameter with no single denominator, not "a tenth on most markets". TAO is the only market near the documented figure, at 9.99%.

The direction of the error matters. On the **18 markets below 10%**, a trader who sizes to a tenth of open interest will overshoot the real cap and get a `MaxPositionSizeExceeded()` (`0x714b36d6`) revert — worst on the six ~2.49% markets, where the documented figure is 4x the actual cap. On **BTC (20.25%) and ZEC (25.00%)** the error runs the other way and a risk tool will under-use the market by 2x-2.5x. ZEC is the clearest case: a tenth of its current 1,680 ZEC cap is 168 ZEC, while the actual per-account cap is 420 ZEC.

Concrete example, BTC:

- Current on-chain `maxOpenInterest`: 493.6309 BTC
- Per-account cap implied by the documented rule: 49.36309 BTC
- Actual on-chain `maxPositionSize`: **100 BTC**

### The published table cannot be used to derive the cap either

Because the table is a pre-increase snapshot, applying "a tenth" to it compounds the error. All 21 table values match `maxOpenInterest` exactly at block 28000000, which is what identifies them as an older reading of the same parameter rather than a typo or a unit error. At the current block only TAO still matches:

| Markets | Table value vs on-chain OI cap |
| --- | --- |
| BTC, ETH, HYPE, SOL | on-chain cap is **2x** the table value |
| ZRO, LIT, VVV, 1000PEPE, PUMP, ZEC, WLD, NEAR, XLM, AVAX, LINK, SUI, ADA, BNB, DOGE, XRP | on-chain cap is **4x** the table value |
| TAO | unchanged |

For BTC the table says 246.81545, so a tenth is 24.681545 BTC against an actual per-account cap of 100 BTC — a 4x underestimate. A trader or risk tool sizing from either documented number is off by 2x-4x on 20 of 21 markets.

The disclaimer covers the table drifting; it does not cover the rule. Even reading the table as freshly as possible, the stated one-tenth relationship produces a wrong per-account cap on every market, and on 18 of them the wrong number is high enough to cause an order revert.

## Evidence

POC output at block 28724732 (two earlier runs at blocks 28631648 and 28631911 reported the same 21 rows and the same 1/21 and 0/21 counts):

```text
chain 50383, current block 28724732, docs-snapshot block 28000000
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
RULE claim ("a tenth ... on most markets") holds: false
TABLE disclaimer on https://app.testnet.dreamdex.io/docs/trading/perps-testnet: "These figures are read from the live markets and can be retuned at any time."
```

Raw per-pool values with `maxOpenInterest` and `maxPositionSize` at both blocks, the table values, the multiplier, the cap/OI ratio in bps, and the URL, section name, quote and disclaimer for each page: [`evidence/docs-risk-limits.json`](../evidence/docs-risk-limits.json).

Docs quotes above are verbatim, fetched 2026-10-20 from the "Common pitfalls" section of https://app.testnet.dreamdex.io/docs/developers/perps-testnet and the "Markets" section of https://app.testnet.dreamdex.io/docs/trading/perps-testnet.

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Network: Somnia Tokyo / Hideki testnet, chain ID 50383
- RPC: `https://api.hideki2.infra.testnet.somnia.network`
- Wallet: `0xa796e1f8a7aECa35086EE56658A90573fBCB0c0b` (read-only POC; no signer, no transactions)
