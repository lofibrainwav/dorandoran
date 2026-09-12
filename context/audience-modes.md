# Audience modes and invariant quality

Family OS supports three ways of explaining the same measured result:

| Mode | Intended reader | What changes | What never changes |
| --- | --- | --- | --- |
| `vibe` | A user who may not know code | Plain language, traffic-light explanation, next action | Gates, decision, exit code, evidence refs, observed counts |
| `engineer` | A technical operator | Technical gate names and failure detail | Gates, decision, exit code, evidence refs, observed counts |
| `professional` | Truth-critical work | Control language and domain vocabulary | Gates, decision, exit code, evidence refs, observed counts |

## Operating contract

The audience is a presentation lens, not a permission or quality shortcut.
`vibe` does not mean lower standards, and `professional` does not mean that
HyoDo has signed off legal, accounting, or architecture work. Human review,
source verification, and domain-specific approval remain required.

All three commands below execute the same `.hyodo/gates.toml` gate set:

```bash
pnpm verify:vibe
pnpm verify:engineer
pnpm verify:truth
```

For law, accounting, or architecture, the professional mode must additionally
show the relevant source, scope, date, reviewer/approver, and unresolved
limitations. A PASS only means the configured checks ran and passed; it is not
a professional opinion or deployment approval.

## Known release boundary

The paired HyoDo source worktree adds explicit `--domain law|accounting|architecture`
selection. Chad continues to use the published HyoDo `4.19.3` wheel until that
source-line change is released and its wheel/CI parity is verified. This keeps
the current branch from claiming a capability that its installed package does
not yet provide.
