# Gas docs: real placeOrderFor orders cost up to 0.029 STT against a documented 0.003 ceiling, and the page's own 1.56M gas figure contradicts its 7.7M estimate

Severity: normal
Area: docs

## Steps to reproduce

1. From a clean checkout, install dependencies and run the read-only POC:
   ```bash
   export PATH=/home/user/.local/share/pnpm/bin:$PATH
   pnpm install
   pnpm poc:gas-claim
   ```
2. The POC re-reads the receipts of four pinned successful `placeOrderFor` transactions sent to listed perp pools. For each it verifies the recipient is a live pool and the selector is `0x80054449`, then records gas used, effective gas price, log count and fee, and compares all of them with the two documented figures.
3. Open the perps developer docs and read two places on the same page:
   https://app.testnet.dreamdex.io/docs/developers/perps-testnet
   - the **"Get test funds"** section, which states the STT cost range;
   - the **"Leave plenty of gas"** subsection (under "Raw and operator calls"), which states the gas ceiling, the `eth_estimateGas` figures and the recommended limit.

## Expected

Both documented figures should hold for real successful orders, and the page should state one consistent maximum gas use.

From "Get test funds":

> Gas is billed on what a transaction uses, not on its gas limit: transactions to perp pools measured on testnet cost between 0.0003 and 0.003 STT each.

From "Leave plenty of gas":

> Successful `placeOrderFor` transactions on testnet used up to about 1.56M gas, and a simple resting order simulated with a 1.5M limit reverts while the same call with 3.2M succeeds.

> `eth_estimateGas` returned 3.2M for a resting order and 7.7M for an IOC that crossed several price levels.

> Gas is billed on what is used, so a generous limit costs nothing extra: the bot kit sends every perp order with 10,000,000.

## Actual

### The STT cost range is exceeded by about 10x, with no base-fee caveat

Three of the four pinned successful orders cost more than the documented 0.003 STT maximum:

| Pool | Block | Gas used | Gas price | Logs | Fee (STT) | Above 0.003 STT |
| --- | --- | --- | --- | --- | --- | --- |
| LIT | 27821051 | 4,853,918 | 6 gwei | 9 | 0.029123508 | yes (9.7x) |
| LIT | 27986878 | 3,963,483 | 6 gwei | 8 | 0.023780898 | yes (7.9x) |
| LIT | 28552762 | 4,062,881 | 6 gwei | 8 | 0.024377286 | yes (8.1x) |
| ADA | 28626845 | 1,529,508 | 0.6 gwei | 3 | 0.0009177048 | no |

The range is stated as a flat measured figure with no dependence on the network base fee, but cost is `gasUsed x effectiveGasPrice` and the four blocks span a **10x gas-price spread (0.6 and 6 gwei)**. The ADA receipt is why the range looks plausible: at 0.6 gwei and a shallow 3-log fill the fee lands inside it. The three LIT receipts are takers crossing resting liquidity (8-9 logs each) in blocks at 6 gwei, and each costs roughly 8-10x the documented maximum. A bot budgeting from "between 0.0003 and 0.003 STT each" will under-provision its gas reserve by an order of magnitude whenever the base fee is at the higher level, which is the level in three of the four blocks sampled.

### The gas ceiling contradicts the estimate in the same paragraph

This is not a claim that the docs fail to anticipate high-gas orders — they do anticipate them. The problem is that the page states two incompatible maxima three sentences apart:

- "used up to about **1.56M** gas" for successful `placeOrderFor`;
- "`eth_estimateGas` returned ... **7.7M** for an IOC that crossed several price levels".

The 7.7M figure is **4.9x** the stated ceiling, so a reader cannot tell which number describes a successful order. Our three LIT transactions are exactly the crossing case the 7.7M sentence describes: they used 3,963,483 / 4,062,881 / 4,853,918 gas, above the 1.56M sentence and below the 7.7M one. Measured against the page's own IOC estimate none of the four receipts is unusual (`0/4` above 7.7M); measured against its stated ceiling, `3/4` exceed it.

The fix is to reconcile the two — the 1.56M sentence reads as a maximum for successful orders, but the same paragraph documents an order type that needs several times that. The **recommended 10,000,000 limit is not affected** and remains sufficient for every transaction sampled here; the incorrect numbers are the flat STT cost range and the "up to about 1.56M" ceiling.

## Evidence

```text
chain 50383, 4 pinned successful placeOrderFor txs
symbol   block      gasUsed    gwei   logs   fee STT        >1.56M   >7.7M   >docs fee
LIT      27821051   4853918    6      9      0.029123508    true     false   true
LIT      27986878   3963483    6      8      0.023780898    true     false   true
LIT      28552762   4062881    6      8      0.024377286    true     false   true
ADA      28626845   1529508    0.6    3      0.0009177048   false    false   false

docs gas ceiling 1560000 (about 1.56M); txs above it: 3/4
docs' own IOC eth_estimateGas 7700000 (7.7M, same paragraph); txs above it: 0/4
=> the page contradicts itself: its 7.7M estimate exceeds its own 1.56M ceiling by 4.9x: true
docs fee range 0.0003-0.003 STT; txs above it: 3/4
gas prices seen across the four blocks (gwei): 0.6, 6
highest gas: LIT 0x8d77ce0a697997d99b4bb3f87c9b3ce722f78c13ed8b6ff24963a4974c938cc0 4853918
highest fee: LIT 0x8d77ce0a697997d99b4bb3f87c9b3ce722f78c13ed8b6ff24963a4974c938cc0 0.029123508 STT
docs cost claim holds for every tx: false
docs gas ceiling holds for every tx: false
```

Pinned transaction hashes:

- `0x8d77ce0a697997d99b4bb3f87c9b3ce722f78c13ed8b6ff24963a4974c938cc0` (LIT, block 27821051)
- `0x6ba52e192185afe272c79680537c68b184431ff8f4abf3e74daebeb8465567ac` (LIT, block 27986878)
- `0xd1b752fb21a8119e6c57900b226d1463ff081d2d83372871df3c633e1aa1b877` (LIT, block 28552762)
- `0xabfb5acfd5ce13721feeaa46dd16db55ee13172aaecad272eb9365e2af7166bb` (ADA, block 28626845)

Raw receipts with per-tx gas, price, log count and computed fee, plus both documented ceilings and the section each quote comes from: [`evidence/docs-gas-claim.json`](../evidence/docs-gas-claim.json).

Docs quotes above are verbatim, fetched 2026-10-20 from the "Get test funds" section and the "Leave plenty of gas" subsection of https://app.testnet.dreamdex.io/docs/developers/perps-testnet.

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Network: Somnia Tokyo / Hideki testnet, chain ID 50383
- RPC: `https://api.hideki2.infra.testnet.somnia.network`
- Wallet: `0xa796e1f8a7aECa35086EE56658A90573fBCB0c0b` (read-only POC; no signer, no transactions)
