# Paper USDso docs exclude six markets that the on-chain allowlist permits

Severity: normal
Area: docs

## Steps to reproduce

1. From a clean checkout, install dependencies and run the read-only POC:
   ```bash
   export PATH=/home/user/.local/share/pnpm/bin:$PATH
   pnpm install
   pnpm poc:voucher-allowlist
   ```
2. The POC lists all 21 markets from the indexer, reads `MarginBank.isVoucherMarketAllowed(pool)` at one pinned block, and compares the result with the "Paper USDso" column of the docs market table.
3. Open the market table and the Paper USDso rules:
   - https://app.testnet.dreamdex.io/docs/developers/perps-testnet
   - https://app.testnet.dreamdex.io/docs/trading/perps-testnet/margin-and-liquidations

## Expected

The docs market table marks `1000PEPE`, `LIT`, `PUMP`, `VVV`, `ZEC` and `ZRO` as **No** under "Paper USDso", and the Margin & Liquidations page says:

> You can open or increase positions only in the markets marked Yes under Paper USDso in the market table. The six newest markets are not on that list.

For those six markets, `isVoucherMarketAllowed(pool)` should return `false`.

## Actual

`isVoucherMarketAllowed(pool)` returns `true` for all 21 markets, including the six the docs exclude. There is no on-chain market restriction for voucher accounts on any live market.

POC output at blocks 28528394 and 28552327 (identical in both runs):

```text
symbol       docs   chain  match
ZRO          No     true   NO
LIT          No     true   NO
VVV          No     true   NO
1000PEPE     No     true   NO
PUMP         No     true   NO
ZEC          No     true   NO
TAO          Yes    true   yes
...
BTC          Yes    true   yes

docs "No" but chain true: 6
mismatches: 6
```

## Evidence

- `evidence/docs-voucher-allowlist.json`: all 21 rows with `docsPaperUsdso`, `chainIsVoucherMarketAllowed`, pool address, and the pinned block.
- Pinned blocks: 28528394 and 28552327, chain 50383 (reproduced twice, same result).
- MarginBank: `0x478769E1177C0773c43A593DCCc4Ad15F15F1394`.
- Raw call: `isVoucherMarketAllowed(address perpPool) view returns (bool)` for each `poolAddress` from `listPerpMarkets`.
- Example: ZRO pool `0x2a1822b02039ddf0e293f3f7243673fc03eaf16c` returned `true`; docs say `No`.

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Network: Somnia Tokyo / Hideki testnet, chain ID 50383
- RPC: `https://api.hideki2.infra.testnet.somnia.network`
- Wallet: `0xa796e1f8a7aECa35086EE56658A90573fBCB0c0b` (read-only POC; no signer)
