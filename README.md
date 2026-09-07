# Chad Family OS — Greenfield

Jayden-centered family coordination, rebuilt on a clean web shell while preserving verified Family OS domain logic.

## Local runtime

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
pnpm install
pnpm dev
```

## Verification

```bash
pnpm verify
```

`pnpm verify` runs HyoDo v4.14.0 in `vibe` mode. HyoDo then runs the configured deterministic typecheck, test, audit, lint, and build gates. Missing/unobserved evidence is not treated as GREEN.

See `AGENTS.md` and `context/` before making changes.
