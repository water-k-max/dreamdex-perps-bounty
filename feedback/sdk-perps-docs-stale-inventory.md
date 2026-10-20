# SDK PERPS.md says only BTC/ETH are live plus 10 pools / 4 restricted SBTC*; Hideki has 21 / 0 and Shannon 24 / 5

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
3. At a single pinned block on each live perps testnet, it calls the
   PerpPoolFactory's `getPerpPools()` and `getPerpPoolStatuses()`, then reads
   each pool's `marginBank()` and the bank's `isPerpPoolRegistered(pool)`, plus
   each base token's `symbol()`:
   - Hideki, chain 50383, factory `0xE631fAEE547baeE07353E290f0562ea67d856560`
   - Shannon, chain 50312, factory `0x516d2cb6de41bE98444e887793946E65989Ba07b`
4. On Hideki it also calls the SDK's own `listPerpPoolStatuses({ factory })`,
   bounded by a block range read around the call.

## Expected

`PERPS.md` opens by naming the live testnet markets:

> Perps are live on testnet: `BTC/USDSO:USDSO` and `ETH/USDSO:USDSO`

and later says, in the section explaining why the factory's raw pool list should
not be used directly:

> Testnet today has 10 pools, four of them restricted `SBTC*` arena markets.

"Testnet" should identify which deployment it describes and match it. The SDK
ships two testnet deployments (`SOMNIA_TESTNET_ADDRESSES` for Shannon 50312 and
`SOMNIA_HIDEKI_TESTNET_ADDRESSES` for Hideki 50383), and the sentence currently
matches neither: the intro should list the live markets or mark BTC and ETH as
examples, and the "today" inventory should be 21 pools / 0 restricted on Hideki
or 24 pools / 5 restricted on Shannon, with the actual restricted symbols named.

## Actual

The documented inventory matches neither live deployment, at two independent
pinned blocks each:

**Hideki (chain 50383):** the factory reports **21 pools, 0 restricted,
21 registered, 21 tradeable**, and **0** base tokens whose symbol starts with
`SBTC` (or `SWBTC`):

- BTC, ETH, SOL, HYPE, XRP, DOGE, BNB, ADA, SUI, LINK, AVAX, XLM, NEAR, WLD,
  TAO, ZEC, PUMP, 1000PEPE, VVV, LIT, ZRO
- The SDK's own `listPerpPoolStatuses({ factory })` returns **21 pools,
  0 restricted, 21 tradeable**, agreeing with the raw reads.

**Shannon (chain 50312):** the factory reports **24 pools, 5 restricted,
24 registered, 19 tradeable**, and **0** literal `SBTC*` symbols:

- Restricted: **SWBTC, SWBTCA, SWBTCB, SWBTCC, SWETH**. The fifth restricted
  pool is not a BTC market at all.
- A sixth BTC variant, **SWBTCD, is deployed but unrestricted**, so the
  `SWBTC*` family alone is five pools, four restricted.
- The intro's BTC/ETH names do not match this deployment either; its base
  tokens are WBTC and WETH.

So the docs' 10-pool / 4-restricted claim is off on both networks: pool count is
+11 on Hideki and +14 on Shannon, and restricted count is -4 on Hideki and +1 on
Shannon. The surrounding advice ("Do not build a market list from the factory's
raw pool list") is still correct, but a builder using the stated inventory as a
test fixture will size and filter the wrong set (10 rows instead of 21 or 24)
and exercise the wrong restriction path. On Hideki there is no restricted market
to exercise at all; on Shannon there are five, one of them outside the `SBTC*`
family the docs point at.

## Evidence

POC output, first run (full output in `evidence/docs-sdk-pool-inventory-run1.txt`):

```text
SDK 0.32.1 node_modules/@somnia-chain/markets-sdk/docs/PERPS.md:3
  "Perps are live on testnet: `BTC/USDSO:USDSO` and `ETH/USDSO:USDSO`"
node_modules/@somnia-chain/markets-sdk/docs/PERPS.md:571
  "Testnet today has 10 pools, four of them restricted `SBTC*` arena markets."

chain 50383 (hideki), block 28694838
factory 0xE631fAEE547baeE07353E290f0562ea67d856560
raw getPerpPools(): 21
getPerpPoolStatuses(): 21 pools, 0 restricted, 21 registered, 21 tradeable
SBTC* base tokens: 0; SWBTC* base tokens: 0 (none)
SDK listPerpPoolStatuses(): 21 pools, 0 restricted, 21 tradeable, 0 undetermined (blocks 28695027..28695057)
docs intro names 2 markets vs chain 21; intro matches: false
docs pools 10 vs chain 21; docs restricted 4 vs chain 0
=> docs match hideki: false

chain 50312 (shannon), block 519473223
factory 0x516d2cb6de41bE98444e887793946E65989Ba07b
raw getPerpPools(): 24
getPerpPoolStatuses(): 24 pools, 5 restricted, 24 registered, 19 tradeable
SBTC* base tokens: 0; SWBTC* base tokens: 5 (SWBTC, SWBTCA, SWBTCB, SWBTCC, SWBTCD)
docs intro names 2 markets vs chain 24; intro matches: false
docs pools 10 vs chain 24; docs restricted 4 vs chain 5
=> docs match shannon: false
```

Second run (fresh process, later blocks; full output in
`evidence/docs-sdk-pool-inventory-run2.txt`):

```text
chain 50383 (hideki), block 28695209
raw getPerpPools(): 21
getPerpPoolStatuses(): 21 pools, 0 restricted, 21 registered, 21 tradeable
SDK listPerpPoolStatuses(): 21 pools, 0 restricted, 21 tradeable, 0 undetermined (blocks 28695312..28695348)
=> docs match hideki: false

chain 50312 (shannon), block 519473521
raw getPerpPools(): 24
getPerpPoolStatuses(): 24 pools, 5 restricted, 24 registered, 19 tradeable
SBTC* base tokens: 0; SWBTC* base tokens: 5 (SWBTC, SWBTCA, SWBTCB, SWBTCC, SWBTCD)
=> docs match shannon: false
```

The committed evidence is `evidence/docs-sdk-pool-inventory.json`. It records
both quotes and their line numbers, the SDK version, one pinned block per
network, all pool/base-token/margin-bank rows, and the Hideki SDK
`listPerpPoolStatuses` result.

Calls used, all `view`, all at each pinned block:

```text
PerpPoolFactory.getPerpPools() view returns (address[])
PerpPoolFactory.getPerpPoolStatuses() view returns ((address perpPool, address baseToken, bool restricted)[])
PerpPool.get marginBank() view returns (address)
MarginBank.isPerpPoolRegistered(address perpPool) view returns (bool)
BaseToken.symbol() view returns (string)
```

## Environment

- SDK `@somnia-chain/markets-sdk` 0.32.1 (pinned)
- Networks: Somnia Hideki testnet, chain ID 50383, and Somnia Shannon testnet,
  chain ID 50312
- Read-only: no signer, no wallet, no transactions
- Wallet: `0xa796e1f8a7aECa35086EE56658A90573fBCB0c0b` (not used by the POC)
- Blocks: Hideki 28694838 and 28695209 (SDK listing runs bounded
  28695027–28695057 and 28695312–28695348); Shannon 519473223 and 519473521
- RPC: `https://api.hideki2.infra.testnet.somnia.network` and
  `https://api.infra.testnet.somnia.network`
