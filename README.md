# dreamDEX Perps Bounty — Feedback Track

Reproducible feedback for the dreamDEX Perps Builder Bounty on Somnia Tokyo (Hideki)
testnet. This repository focuses on SDK, API, and documentation issues found while
building against `@somnia-chain/markets-sdk` 0.32.1 and the public perps docs.

This is a testnet-only project. No mainnet contracts are touched and no real funds are used.

## Scope

- Network: Somnia Tokyo / Hideki testnet, chain ID 50383.
- SDK: `@somnia-chain/markets-sdk` 0.32.1.
- Areas: SDK, GraphQL indexer/API, and documentation.
- Reports live in [`feedback/`](feedback/); each file follows the bounty's required format.
- Index of reports and status: [`feedback/INDEX.md`](feedback/INDEX.md).

## Layout

```
AGENTS.md            Bounty rules, scope, severity rubric, and testing policy
feedback/            One Markdown report per issue
poc/                 Minimal reproduction scripts
evidence/            Raw logs, JSON, and transaction evidence (no secrets)
src/                 Shared SDK/viem harness and read-only probes
```

## Setup

Requirements: Node.js 20+ and pnpm. On this machine:

```bash
export PATH=/home/user/.local/share/pnpm/bin:$PATH
pnpm install
cp .env.example .env
pnpm wallet:new          # generates a throwaway testnet key, writes only to .env
```

Fund the generated address with a small amount of STT for gas. The wallet address is
printed by `pnpm wallet:new`. The paper USDso voucher is claimed from that account once it
is eligible.

Read-only baseline:

```bash
pnpm probe:markets
pnpm probe:reads
pnpm typecheck
```

## Reproduction rules

Every report must name its POC command and include:

- SDK version, chain ID, and wallet address.
- Exact steps from a clean process.
- Expected and actual behavior.
- Raw requests/calls, block number, and a transaction hash when applicable.
- No private keys, API tokens, or third-party personal data.

## Status

Work in progress for the October 19 – November 1, 2026 bounty window. Reports are submitted
as they are verified.

## Links

- Developer docs: https://app.testnet.dreamdex.io/docs/developers/perps-testnet
- Trading docs: https://app.testnet.dreamdex.io/docs/trading/perps-testnet
- Bot kit: https://github.com/somnia-chain/dreamdex-bot-kit
