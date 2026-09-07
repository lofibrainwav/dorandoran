# AI Workflow Rules

Completion contract:
1. run the relevant local test first
2. make the smallest scoped change
3. run `pnpm verify`
4. run `git diff --check`
5. only then commit/push

HyoDo rules:
- `GREEN` means observed checks passed, not automatic approval.
- `GREY / UNOBSERVED` is never success.
- `RED` inside the active feature scope may receive a minimal bounded repair.
- Stop and ask before changing architecture, authority, privacy, SSOT, or verified domain behavior to escape a RED.
- Never weaken `.hyodo/gates.toml` to make a build pass.

Drift control:
- one active feature spec at a time
- do not rewrite verified core when shell/config is the failing layer
- record real blockers in `context/progress_tracker.md`
