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
