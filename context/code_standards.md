# Code Standards Router

Canonical domain behavior lives in `lib/family-os/` and `tests/family-os/`.
Do not duplicate those contracts in docs.

Rules:
- TypeScript strict mode remains on.
- Prefer pure functions for deterministic decision logic.
- Adapters normalize external payloads into internal types; core logic does not import provider SDKs.
- No `any` in new Family OS code unless a provider boundary is immediately narrowed/validated.
- Existing core tests are regression gates; extend them, do not weaken or delete them.
- Existing security, lint, typecheck, test, and build gates must remain enabled.
- No private family truth in public fixtures.

Verification commands:
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm audit --prod --audit-level high`
Recovery note: if type/schema changes are correct but Next reports stale generated/bundled state, verify the evidence first; then clear `.next` and rebuild. Do not use cache deletion to hide a real type/test failure.