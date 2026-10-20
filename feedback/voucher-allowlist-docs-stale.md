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
2. The POC lists all 21 markets from the indexer and reads two MarginBank views at one pinned block: `isVoucherMarketAllowed(pool)` for every pool, and `getVoucherLeverageCap()`. Those are the two inputs to the SDK's own `voucherBlocked` predicate, so the POC rules out both triggers rather than assuming the allowlist is the only one. It then compares the result with the "Paper USDso" column of the docs market table.
3. Open the market table and the Paper USDso rules:
   - https://app.testnet.dreamdex.io/docs/developers/perps-testnet
   - https://app.testnet.dreamdex.io/docs/trading/perps-testnet/margin-and-liquidations

## Expected

The docs market table marks `1000PEPE`, `LIT`, `PUMP`, `VVV`, `ZEC` and `ZRO` as **No** under "Paper USDso", and the Margin & Liquidations page says:

> You can open or increase positions only in the markets marked Yes under Paper USDso in the market table. The six newest markets are not on that list.

The same page's "Common pitfalls" section describes the resulting failure mode:

> Paper USDso blocks some markets. Increasing a position in a market outside the credit's allowlist reverts, and getMaxPerpOrderSize reports it as limitedBy: voucherBlocked.

For those six markets, `isVoucherMarketAllowed(pool)` should return `false`, and increasing a voucher position should revert with the order size reported as `limitedBy: voucherBlocked`.

The market allowlist is not the only input to that outcome. The SDK derives it in `src/perp/margin.ts:2153`:

```ts
const voucherBlocked = voucherActive && (!p.voucherMarketAllowed || p.voucherLeverageCapX === 0);
```

and the comment above it names the two distinct placement reverts, `VoucherMarketNotAllowed` and `VoucherLeverageCapNotSet`. So the documented failure mode is unreachable only if the market is allowlisted **and** the leverage cap is set; the POC checks both.

## Actual

`isVoucherMarketAllowed(pool)` returns `true` for all 21 markets, including the six the docs exclude, and `getVoucherLeverageCap()` returns `20` rather than `0`. Neither trigger of `voucherBlocked` fires on any live market, so there is no on-chain market restriction for voucher accounts and the documented `voucherBlocked` failure mode cannot occur on any current market.

POC output at block 28721461 (earlier runs at blocks 28528394 and 28552327 gave the same 6/6 mismatch):

```text
chain 50383, block 28721461
MarginBank 0x478769e1177c0773c43a593dccc4ad15f15f1394
markets 21
getVoucherLeverageCap() 20 (unset, i.e. 0: false)
symbol       docs   chain  blocked  match
ZRO          No     true   false    NO
LIT          No     true   false    NO
VVV          No     true   false    NO
1000PEPE     No     true   false    NO
PUMP         No     true   false    NO
ZEC          No     true   false    NO
TAO          Yes    true   false    yes
...
BTC          Yes    true   false    yes

docs "No" but chain true: 6
mismatches: 6
markets where the SDK would report voucherBlocked: 0
=> documented voucherBlocked failure mode reachable on any current market: false
```

## Evidence

- `evidence/docs-voucher-allowlist.json`: all 21 rows with `docsPaperUsdso`, `chainIsVoucherMarketAllowed`, `chainSdkVoucherBlocked`, pool address, and the pinned block, plus `voucherLeverageCap` and `voucherLeverageCapUnset`.
- Pinned blocks: 28721461, and earlier runs at 28528394 and 28552327; chain 50383 (reproduced three times, same result).
- MarginBank: `0x478769E1177C0773c43A593DCCc4Ad15F15F1394`.
- Raw calls, both pinned to the same block: `isVoucherMarketAllowed(address perpPool) view returns (bool)` for each `poolAddress` from `listPerpMarkets`, and `getVoucherLeverageCap() view returns (uint256)` → `20`.
- SDK predicate checked against: `node_modules/@somnia-chain/markets-sdk/src/perp/margin.ts:2153`.
- Example: ZRO pool `0x2a1822b02039ddf0e293f3f7243673fc03eaf16c` returned `true`; docs say `No`.

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Network: Somnia Tokyo / Hideki testnet, chain ID 50383
- RPC: `https://api.hideki2.infra.testnet.somnia.network`
- Wallet: `0xa796e1f8a7aECa35086EE56658A90573fBCB0c0b` (read-only POC; no signer)
