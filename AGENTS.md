# Chad Family OS — Agent Entry Point

Read in this order before changing code:
1. `context/project_overview.md`
2. `context/architecture.md`
3. `context/code_standards.md`
4. `context/ai_workflow_rules.md`
5. `context/ui_context.md`
6. `context/progress_tracker.md`

Non-negotiables:
- `lib/family-os` is the verified domain core.
- `tests/family-os` must stay GREEN.
- HyoDo is the completion gate; UNOBSERVED is never GREEN.
- External credentials and raw family data stay server/private.
- WebGPU hero is optional presentation, never a dependency of Family Week.
- One subsystem at a time; do not expand scope to fix a local RED.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
