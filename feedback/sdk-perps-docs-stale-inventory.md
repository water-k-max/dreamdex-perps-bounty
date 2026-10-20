# SDK PERPS.md says only BTC/ETH are live and lists 10 pools, four restricted SBTC*; the factory has 21 and none restricted

Severity: normal
Area: docs

## Steps to reproduce

1. From a clean checkout, install dependencies and run the read-only POC:
   ```bash
   export PATH=/home/user/.local/share/pnpm/bin:$PATH
   pnpm install
   pnpm poc:sdk-pool-inventory
   ```
2. The POC reads the claims directly from the pinned SDK package:
   `node_modules/@somnia-chain/markets-sdk/docs/PERPS.md:3` and `:571`,
   and prints the sentences it finds.
3. At a single pinned block, it calls the PerpPoolFactory's `getPerpPools()` and
   `getPerpPoolStatuses()`, then reads each pool's `marginBank()` and the bank's
   `isPerpPoolRegistered(pool)`, plus each base token's `symbol()`.
4. It also calls the SDK's own `listPerpPoolStatuses({ factory })` on the same
   testnet deployment.

## Expected

`PERPS.md` opens by naming the live testnet markets:

> Perps are live on testnet: `BTC/USDSO:USDSO` and `ETH/USDSO:USDSO`

and later says, in the section explaining why the factory's raw pool list should
not be used directly:

> Testnet today has 10 pools, four of them restricted `SBTC*` arena markets.

The documented inventory and restriction state should match the live testnet. At
the blocks below that is 21 live markets, none restricted, with no `SBTC*` base
tokens; the intro should either list them all or mark BTC and ETH as examples,
and the "today" count should not be 10 with four restricted markets.

## Actual

At block 28668474 (and again at block 28668621), the testnet factory reports the
opposite of every clause:

- The intro names **2** live markets, BTC and ETH; the chain has **21**.
- `getPerpPools()` returns **21** pools.
- `getPerpPoolStatuses()` returns **21 pools, 0 restricted, 21 registered**.
- All **21** are tradeable, and **0** base tokens have an `SBTC*` symbol.
- The SDK's own `listPerpPoolStatuses({ factory })` returns **21 pools,
  0 restricted, 21 tradeable**, agreeing with the raw reads.

The intro omits 19 live markets, the documented pool count is off by 11, and
there are no restricted markets at all, let alone four `SBTC*` arena markets.
The surrounding paragraph's advice ("Do not build a market list from the
factory's raw pool list") is still correct, but a builder using the stated
inventory as a test fixture will size and filter the wrong set: 10 rows instead
of 21, and a restriction path that has no live example to exercise.

## Evidence

POC output, first run:

```text
SDK 0.32.1 node_modules/@somnia-chain/markets-sdk/docs/PERPS.md:3
  "Perps are live on testnet: `BTC/USDSO:USDSO` and `ETH/USDSO:USDSO`"
node_modules/@somnia-chain/markets-sdk/docs/PERPS.md:571
  "Testnet today has 10 pools, four of them restricted `SBTC*` arena markets."

chain 50383, block 28668474
factory 0xE631fAEE547baeE07353E290f0562ea67d856560
raw getPerpPools(): 21
getPerpPoolStatuses(): 21 pools, 0 restricted, 21 registered, 21 tradeable
SBTC* base tokens: 0

SDK listPerpPoolStatuses(): 21 pools, 0 restricted, 21 tradeable, 0 undetermined (blocks 28668559..28668595)

docs intro names 2 markets vs chain 21; intro matches: false
docs pools 10 vs chain 21; docs restricted 4 vs chain 0
=> docs match chain: false
```

Second run (fresh process, later block):

```text
chain 50383, block 28668621
raw getPerpPools(): 21
getPerpPoolStatuses(): 21 pools, 0 restricted, 21 registered, 21 tradeable
SBTC* base tokens: 0
SDK listPerpPoolStatuses(): 21 pools, 0 restricted, 21 tradeable, 0 undetermined (blocks 28668689..28668727)
docs intro names 2 markets vs chain 21; intro matches: false
docs pools 10 vs chain 21; docs restricted 4 vs chain 0
```

The committed evidence is `evidence/docs-sdk-pool-inventory.json`. It records
both quotes and their line numbers, the SDK version, the pinned block, all 21
pool/base-token/margin-bank rows, and the SDK `listPerpPoolStatuses` result.

Calls used, all `view`, all at the pinned block:

```text
PerpPoolFactory.getPerpPools() view returns (address[])
PerpPoolFactory.getPerpPoolStatuses() view returns ((address perpPool, address baseToken, bool restricted)[])
PerpPool.get marginBank() view returns (address)
MarginBank.isPerpPoolRegistered(address perpPool) view returns (bool)
BaseToken.symbol() view returns (string)
```

## Environment

- SDK `@somnia-chain/markets-sdk` 0.32.1 (pinned)
- Network: Somnia Tokyo testnet (Hideki), chain ID 50383
- Read-only: no signer, no wallet, no transactions
- Blocks: 28668474 and 28668621 (SDK listing runs bounded 28668559–28668595 and 28668689–28668727)
- RPC: `https://api.hideki2.infra.testnet.somnia.network`
