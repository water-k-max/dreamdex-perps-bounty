# dreamDEX Perps Builder Bounty — Agent Instructions

This repository collects reproducible feedback for the dreamDEX Perps Builder Bounty on
Somnia Tokyo (Hideki) testnet. The active track here is **Feedback**; the MVP track is out
of scope unless the owner explicitly changes it.

## Program summary

- Program: dreamDEX Perps Builder Bounty, October 19 to November 1, 2026.
- Feedback track: find bugs, API and SDK issues, documentation gaps, and missing features.
  Every accepted report is paid.
  - $40 for each accepted critical or major item.
  - $15 for each other accepted item.
  - Accepted only if reproducible. Only the first valid report of an issue is paid;
    duplicates are closed.
  - Payouts stop once the $1,500 feedback budget is used.
- MVP track: out of scope for this repository. Three MVPs win $500 each.
- Registration: open to everyone; only whitelisted emails can submit Builds. The owner is
  responsible for DoraHacks registration and whitelist status.
- Submission deadline: November 1, 2026, 23:59 UTC. Stop new testing by October 30 to leave
  time for clean reproduction and submission.

## Current scope

Areas: **SDK, API, docs**. Browser testing of app.testnet.dreamdex.io is not in scope for
this session. Contracts are tested only through documented SDK/API flows and read-only calls;
no exploit development.

Network: Somnia Tokyo / Hideki testnet only.

| Item | Value |
| --- | --- |
| Chain ID | 50383 |
| RPC | https://api.hideki2.infra.testnet.somnia.network |
| WebSocket | wss://api.hideki2.infra.testnet.somnia.network/ws |
| Indexer (GraphQL) | https://hideki-dev.smk.somnia.host/v1/graphql |
| Explorer | https://explorer.testnet.somnia.network/tokyo |
| Gas coin | STT |
| SDK | @somnia-chain/markets-sdk 0.32.1 (pinned) |
| Collateral | USDso, 18 decimals |

Documented perps addresses (verify against market rows at runtime):

- MarginBank: `0x478769E1177C0773c43A593DCCc4Ad15F15F1394`
- Collateral (USDso): `0xed7993A74dAe1e6656B704A424DcD8711aAf4F72`
- PerpPoolFactory: `0xE631fAEE547baeE07353E290f0562ea67d856560`
- LiquidationEngine: `0xA66d3C24Ad4a389d863846905D8173e1017e9F4D`
- InsuranceFund: `0x50826894D47C6D4f3BeA38BFDC7Dc5c5be171b80`
- VoucherDistributor: `0x2ACD9EFdA721450906bfE1bef3edE269636E42C4`
- OperatorPermissionsRegistry: `0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a`

Read `poolAddress`, `marginBank`, and `stopRegistry` from each market row instead of
hardcoding them in POCs.

## Target resources

- https://app.testnet.dreamdex.io/docs/developers/perps-testnet
- https://app.testnet.dreamdex.io/docs/trading/perps-testnet
- https://app.testnet.dreamdex.io/docs/trading/perps-testnet/orders
- https://app.testnet.dreamdex.io/docs/trading/perps-testnet/margin-and-liquidations
- https://app.testnet.dreamdex.io/docs/trading/perps-testnet/funding
- https://somnia-platform-docs.vercel.app/markets/somnia-markets
- https://github.com/somnia-chain/dreamdex-bot-kit

SDK source and packaged docs are available under `node_modules/@somnia-chain/markets-sdk`
(`src/`, `dist/`, `docs/PERPS.md`).

## Report format

One Markdown file per issue in `feedback/`, using exactly this structure:

```markdown
# Short title
Severity: critical | major | normal
Area: API | SDK | docs | app | contracts

## Steps to reproduce
1. ...

## Expected

## Actual

## Evidence
Transaction hash, request and response, screenshots

## Environment
SDK version, network (Somnia Tokyo testnet), wallet address
```

Keep each report self-contained. The title must be specific. Steps must start from a clean
process and name the exact POC command. Evidence must include raw request/response or call
data, block number, and a transaction hash when a write is involved.

## Severity rubric

- **critical** — funds or account safety at risk: margin/withdrawal bypass, permission
  bypass, wrong liquidation/PnL that can cause loss, replay, or a public fund-loss path.
  Report privately to security@dreamdex.io first; do not commit exploit details.
- **major** — a documented flow fails, wrong financial result, max size or liquidation
  estimate that causes a revert, wrong eligibility, API/indexer returns incorrect data, or
  documentation that causes failed orders or financial mistakes.
- **normal** — reproducible documentation gaps, misleading errors, missing low-impact
  features, or minor inconsistencies that do not break a flow.

Do not inflate severity. The acceptance bar is reproducibility, clarity, and usefulness.

## Rules of engagement

- Testnet only. Never interact with mainnet contracts.
- Use only accounts and wallets created for this bounty. Do not touch other users' accounts.
- No load testing, flooding, resource-exhaustion attempts, or denial-of-service testing.
- No attempts to extract funds, exploit the deployment, or access infrastructure.
- Keep private keys only in `.env` (gitignored). Never put keys, API tokens, or personal data
  in reports, screenshots, logs, commits, or the GitHub repo.
- Use small order sizes and clean up resting orders/stops after each test.
- If a genuine security vulnerability is found, email security@dreamdex.io privately and
  keep it out of this public repository.

## Dedupe policy

Before writing a report:

1. Search the dreamDEX bot kit issues and docs for the same behavior.
2. Check `docs/gotchas.md`, the developer perps page "Common pitfalls", and `INDEX.md`.
3. Confirm the behavior is not already documented as expected.
4. Only then reproduce it twice and write a report.

Known public issues and documented pitfalls are not new reports. A documentation issue is
valid only when the docs themselves are wrong, contradictory, or cause a failed flow.

## Repository layout

```
AGENTS.md            This guide
README.md            Public project overview and reproduction instructions
feedback/            One Markdown report per issue, plus INDEX.md
poc/                 Minimal reproduction scripts, one per report
evidence/            Raw logs, JSON, tx hashes, screenshots (no secrets)
src/                 Shared SDK/viem harness and read-only probes
.env.example         Environment template
.env                 Local secrets (gitignored)
```

## Workflow

1. Baseline: verify network, markets, SDK version, addresses, decimals, and docs examples.
2. Static audit: review perps SDK modules and bot-kit perp-core for concrete defects.
3. Build candidate POCs; record expected vs actual and severity.
4. Reproduce read-only or with the smallest funded transaction.
5. Reproduce again from a clean process and capture evidence.
6. Write the report in the exact format and submit early.
7. Update `feedback/INDEX.md`.

## Environment

- Node is available through the pnpm shim:
  `export PATH=/home/user/.local/share/pnpm/bin:$PATH`
- Install: `pnpm install`
- Generate the throwaway wallet: `pnpm wallet:new` (writes only to `.env`)
- Baseline: `pnpm probe:markets`
- Typecheck: `pnpm typecheck`
