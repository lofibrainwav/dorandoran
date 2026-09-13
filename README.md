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

`pnpm verify` runs HyoDo v4.19.3 using the configured audience profile. The
audience changes explanation vocabulary only; every mode runs the same
deterministic typecheck, test, audit, lint, and build gates, and missing or
unobserved evidence is never treated as GREEN.

Choose the reading mode without changing the quality bar:

```bash
pnpm verify:vibe       # plain-language delivery for vibe coding
pnpm verify:engineer   # technical audit language
pnpm verify:truth      # professional / truth-critical control language
```

The law, accounting, and architecture domain vocabulary is being added to the
HyoDo source line in the paired HyoDo worktree; it is not claimed as available
from the published 4.19.3 wheel until that change is released.

See `AGENTS.md` and `context/` before making changes.
