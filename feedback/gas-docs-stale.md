# Gas docs understate placeOrderFor cost: successful orders used 4.9M gas and cost 0.029 STT vs documented 1.56M / 0.003

Severity: normal
Area: docs

## Steps to reproduce

1. From a clean checkout, install dependencies and run the read-only POC:
   ```bash
   export PATH=/home/user/.local/share/pnpm/bin:$PATH
   pnpm install
   pnpm poc:gas-claim
   ```
2. The POC re-reads the receipts of four pinned successful `placeOrderFor` transactions sent to listed perp pools, verifies each recipient is a live pool and each selector is `0x80054449`, and compares gas used and fee with the documented limits.
3. Read the "Financial Parameters & Claims" section:
   https://app.testnet.dreamdex.io/docs/developers/perps-testnet

## Expected

The docs state:

> Transactions to perp pools measured on testnet cost between 0.0003 and 0.003 STT each.

> Successful placeOrderFor transactions used up to about 1.56M gas; recommended limit 10,000,000.

Every successful `placeOrderFor` should therefore use at most about 1.56M gas and cost at most 0.003 STT.

## Actual

Three of the four pinned successful orders exceed both documented ceilings:

| Pool | Block | Gas used | Gas price | Fee (STT) | Above 1.56M gas | Above 0.003 STT |
| --- | --- | --- | --- | --- | --- | --- |
| LIT | 27821051 | 4,853,918 | 6 gwei | 0.029123508 | yes | yes |
| LIT | 27986878 | 3,963,483 | 6 gwei | 0.023780898 | yes | yes |
| LIT | 28552762 | 4,062,881 | 6 gwei | 0.024377286 | yes | yes |
| ADA | 28626845 | 1,529,508 | 0.6 gwei | 0.0009177048 | no | no |

The highest case is 3.1x the documented gas ceiling and 9.7x the documented maximum cost. The ADA receipt shows why the docs look plausible: at 0.6 gwei and lower gas use the fee falls inside the stated range, but cost scales with the network base fee (6 gwei in the other three blocks) and with the number of resting orders the taker crosses (the LIT transactions emitted 8–9 logs). A fixed "up to" figure does not cover either variable.

The recommended 10,000,000 gas limit remains sufficient for these transactions; the incorrect numbers are the stated maximum gas use and the 0.0003–0.003 STT cost range.

## Evidence

```text
chain 50383, 4 pinned successful placeOrderFor txs
symbol   block      gasUsed    gwei   fee STT        >docs gas  >docs fee
LIT      27821051   4853918    6      0.029123508    true       true
LIT      27986878   3963483    6      0.023780898    true       true
LIT      28552762   4062881    6      0.024377286    true       true
ADA      28626845   1529508    0.6    0.0009177048   false      false

docs gas ceiling 1560000 (about 1.56M); txs above it: 3/4
docs fee range 0.0003-0.003 STT; txs above it: 3/4
highest gas: LIT 0x8d77ce0a697997d99b4bb3f87c9b3ce722f78c13ed8b6ff24963a4974c938cc0 4853918
highest fee: LIT 0x8d77ce0a697997d99b4bb3f87c9b3ce722f78c13ed8b6ff24963a4974c938cc0 0.029123508 STT
docs cost claim holds for every tx: false
docs gas claim holds for every tx: false
```

Pinned transaction hashes:

- `0x8d77ce0a697997d99b4bb3f87c9b3ce722f78c13ed8b6ff24963a4974c938cc0` (LIT, block 27821051)
- `0x6ba52e192185afe272c79680537c68b184431ff8f4abf3e74daebeb8465567ac` (LIT, block 27986878)
- `0xd1b752fb21a8119e6c57900b226d1463ff081d2d83372871df3c633e1aa1b877` (LIT, block 28552762)
- `0xabfb5acfd5ce13721feeaa46dd16db55ee13172aaecad272eb9365e2af7166bb` (ADA, block 28626845)

Raw receipts, selector and pool checks, and computed fees: [`evidence/docs-gas-claim.json`](../evidence/docs-gas-claim.json).

Docs quotes (fetched 2026-10-20):

> Transactions to perp pools measured on testnet cost between 0.0003 and 0.003 STT each.

> Successful placeOrderFor transactions used up to about 1.56M gas; recommended limit 10,000,000.

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Network: Somnia Tokyo / Hideki testnet, chain ID 50383
- RPC: `https://api.hideki2.infra.testnet.somnia.network`
- Wallet: `0xa796e1f8a7aECa35086EE56658A90573fBCB0c0b` (read-only POC; no signer, no transactions)
