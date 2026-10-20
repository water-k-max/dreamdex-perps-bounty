# Testnet builder-fee docs say 100 BPS on every pool and 0 on testnet; perp pools cap at 10 BPS

Severity: normal
Area: docs

## Steps to reproduce

1. From a clean checkout, install dependencies and run the read-only POC:
   ```bash
   export PATH=/home/user/.local/share/pnpm/bin:$PATH
   pnpm install
   pnpm poc:builder-cap
   ```
2. The POC fetches the two testnet docs pages as raw Markdown and asserts the quoted
   sentences are present:
   - `https://app.testnet.dreamdex.io/docs/developers/contracts/errors.md`
   - `https://app.testnet.dreamdex.io/docs/developers/contracts/functions.md`
3. At a single pinned block it reads `getMaxBuilderFeeBpsTimes1k()` for all 21 perp
   pools returned by the PerpPoolFactory's `getPerpPoolStatuses()`, and for all 3
   spot pools returned by the SDK's `listSpotMarkets()`.
4. Compare the documented values with the chain.

## Expected

The three statements should agree with each other and with the deployed testnet
pools:

> Every mainnet and testnet pool currently runs a `100000` (100 BPS) cap

> the cap is `100000` (100 BPS = 1%) on every pool on both networks

> Currently `100000` (100 BPS = 1%) on mainnet and `0` on testnet.

Either every testnet pool returns `100000`, or testnet returns `0`, but not both.

## Actual

On testnet, the two claims are both false, and they contradict each other:

- All **21 perp pools** return `getMaxBuilderFeeBpsTimes1k() = 10000` (10 BPS),
  not `100000`.
- All **3 spot pools** return `100000` (100 BPS), so the testnet cap is not `0`
  anywhere.
- No testnet pool returns `0`, and none of the 21 perp pools matches the
  documented `100000` cap.

A builder who follows the two "every pool" statements and approves or charges a
fee between 10 and 100 BPS on a perp market exceeds that pool's cap; the same
pages' error table lists that as `BuilderFeeExceedsCap()`. A builder who follows
the getter entry and concludes testnet builder codes are disabled (cap `0`) would
skip an integration that is in fact live on all 24 pools with non-zero caps.
The docs do say to read the cap at runtime, which limits the damage, but the
stated values still send integrators the wrong way for perp markets.

## Evidence

POC output, first run:

```text
docs https://app.testnet.dreamdex.io/docs/developers/contracts/errors.md
  "Every mainnet and testnet pool currently runs a `100000` (100 BPS) cap"
docs https://app.testnet.dreamdex.io/docs/developers/contracts/functions.md
  "the cap is `100000` (100 BPS = 1%) on every pool on both networks"
  "Currently `100000` (100 BPS = 1%) on mainnet and `0` on testnet."

chain 50383, block 28661041
perp pools: 21, caps {"10000":21}
spot pools: 3, caps {"100000":3}

all 24 testnet pools cap at 100000: false
all 24 testnet pools cap at 0:      false
perp pools all cap at 10000:               true
spot pools all cap at 100000:              true
```

Second run (fresh process, later block):

```text
chain 50383, block 28661364
perp pools: 21, caps {"10000":21}
spot pools: 3, caps {"100000":3}
all 24 testnet pools cap at 100000: false
all 24 testnet pools cap at 0:      false
```

The committed evidence is `evidence/docs-builder-cap.json`. It records the
quoted sentences, both docs URLs, the pinned block, every perp and spot pool
address with its cap, and the summary flags.

Calls used, all `view`, all at the pinned block:

```text
PerpPoolFactory.getPerpPoolStatuses() view returns ((address perpPool, address baseToken, bool restricted)[])
Pool.getMaxBuilderFeeBpsTimes1k() view returns (uint256)
```

## Environment

- SDK `@somnia-chain/markets-sdk` 0.32.1 (pinned)
- Network: Somnia Tokyo testnet (Hideki), chain ID 50383
- Read-only: no signer, no wallet, no transactions
- Blocks: 28661041 and 28661364
- RPC: `https://api.hideki2.infra.testnet.somnia.network`
- Docs: `https://app.testnet.dreamdex.io/docs/developers/contracts/{errors,functions}.md`
