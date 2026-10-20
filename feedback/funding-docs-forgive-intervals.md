# Funding docs say all elapsed funding settles at once, but settlements forgive every interval beyond the first

Severity: major
Area: docs

## Steps to reproduce

1. From a clean checkout, install dependencies and run the read-only POC:
   ```bash
   export PATH=/home/user/.local/share/pnpm/bin:$PATH
   pnpm install
   pnpm poc:funding-catchup
   ```
2. The POC reads the `LIT-PERP` funding history from the public indexer and prints the settlement at 2026-10-17T09:03:12Z (block 25760678), whose row has `intervalsSettled=15` and `intervalsAccrued=1`.
3. Open the funding docs page and read the paragraph beginning "Funding is applied to your position the next time it is touched":
   https://app.testnet.dreamdex.io/docs/trading/perps-testnet/funding

## Expected

The docs state that when funding is next applied, "everything owed since the last time is settled at once. The result is the same as paying every hour."

A 15-hour gap should therefore accrue 15 hourly intervals.

## Actual

The indexed settlement shows 15 intervals were spanned but only 1 interval accrued. The SDK's own `FundingRateUpdate.intervalsAccrued` documentation states the contract's catch-up horizon charges at most one interval per settlement however long the gap, and the rest is forgiven at zero funding.

For the LIT settlement:

- `intervalsSettled`: 15
- `intervalsAccrued`: 1
- `spanStart`: 1792223721 (2026-10-17T08:15:21Z)
- `spanEnd`: 1792227321 (2026-10-17T09:15:21Z)
- settled wall-clock span: 54,000 seconds (15 x 3,600)
- accrued span: 3,600 seconds
- forgiven: 50,400 seconds (14 hourly intervals)

The same pattern is visible in other markets' indexed settlements, so this is not a one-off. A trader who expects to pay or receive all 15 hours of funding after a gap is charged or paid for one hour.

## Evidence

POC output:

```text
pool LIT 0xdcb0ad226727b2ce92857f0af5751389d42b2a3f
on-chain rate denominator fundingWindowSec=28800, settlement fundingIntervalSec=3600
row 0xdcb0ad226727b2ce92857f0af5751389d42b2a3f_25760678_19
block 25760678 tx 0x1995d52346e4d034f95fe3d942e0b7b4b68862e82f61529e5eb361bcf71d1474
timestamp 1792227792 (2026-10-17T09:03:12.000Z)
intervalsSettled=15 intervalsAccrued=1
spanStart=1792223721 spanEnd=1792227321
settled span 54000s (15 intervals)
accrued span 3600s; forgiven 50400s
=> claim holds: false
```

Raw row and computed values: [`evidence/docs-funding-catchup.json`](../evidence/docs-funding-catchup.json).

SDK source that contradicts the docs (`node_modules/@somnia-chain/markets-sdk/src/perp/history.ts`, `intervalsAccrued`):

> The contract's catch-up horizon charges at most **one interval** per settlement however long the gap, so a value below `intervalsSettled` means the excess was FORGIVEN at zero funding rather than deferred. The forgiven intervals are the OLDEST ones.

Docs quote (fetched 2026-10-20):

> Funding is applied to your position the next time it is touched, by a trade, a withdrawal or a liquidation, and everything owed since the last time is settled at once. The result is the same as paying every hour.

## Environment

- SDK: `@somnia-chain/markets-sdk` 0.32.1
- Network: Somnia Tokyo / Hideki testnet, chain ID 50383
- Indexer: `https://hideki-dev.smk.somnia.host/v1/graphql`
- Wallet: `0xa796e1f8a7aECa35086EE56658A90573fBCB0c0b` (read-only POC; no signer)
