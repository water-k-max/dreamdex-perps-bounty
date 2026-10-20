# Liquidation docs claim no backstop bidders are registered, but the engine reports one

Severity: normal
Area: docs

## Steps to reproduce

1. From a clean checkout, install dependencies and run the read-only POC:
   ```bash
   export PATH=/home/user/.local/share/pnpm/bin:$PATH
   pnpm install
   pnpm poc:bidder-count
   ```
2. The POC resolves the LiquidationEngine from `getPerpSystemConfig(marginBank)` and calls the SDK's `getLiquidationEngineConfig(engine)`, then reads `getBidders()` at the same block.
3. Open the liquidation waterfall section:
   https://app.testnet.dreamdex.io/docs/trading/perps-testnet/margin-and-liquidations

## Expected

The docs state:

> No backstop bidders are registered on testnet, so the later stages come in sooner.

`bidderCount` should be `0`, and `getBidders()` should be empty.

## Actual

`getLiquidationEngineConfig` reports `bidderCount: 1n`, and `getBidders()` returns one address with deployed runtime code:

```text
LiquidationEngine 0xA66d3C24Ad4a389d863846905D8173e1017e9F4D
penaltyBps 100
minSpreadBps 50
maxSpreadBps 500
maxVolumePerBlock 100000000000000000000000
bidderCount 1
getBidders [{"address":"0xAF327764345c2f54C1F2bc3322D28E4f633793b9","runtimeCodeBytes":176}]

docs claim holds: false
```

The SDK's own `getLiquidationEngineConfig` documentation treats `bidderCount === 0n` as the operational signal that the takeover stage has nobody to take a position over. That signal is false on this deployment.

## Evidence

- `evidence/docs-bidder-count.json`: system config, engine config and bidder list at blocks 28551128..28551149 and 28552599..28552620 (reproduced twice, same address and count).
- Chain 50383, block 28551128.
- LiquidationEngine: `0xA66d3C24Ad4a389d863846905D8173e1017e9F4D`.
- `bidderCount` raw value: `1`.
- `getBidders()` raw value: `["0xAF327764345c2f54C1F2bc3322D28E4f633793b9"]`.
- `eth_getCode` for the bidder at the same block: 176 bytes.

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Network: Somnia Tokyo / Hideki testnet, chain ID 50383
- RPC: `https://api.hideki2.infra.testnet.somnia.network`
- Wallet: `0xa796e1f8a7aECa35086EE56658A90573fBCB0c0b` (read-only POC; no signer)
