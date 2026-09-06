# AI Workflow Rules

Source-backed workflow:
- Work on one feature unit/subsystem at a time.
- Read the active feature spec before coding.
- Do not expand scope because a nearby improvement looks useful.
- Verify the unit against its checklist before moving on.
- Keep backend/core changes separate from UI wiring.

Project friction rule:
- Within an already-approved feature spec, fix deterministic test/type/lint/build failures with the smallest local change and record the result.
- Stop and ask before changing architecture boundaries, authority semantics, SSOT ownership, privacy rules, repo topology, or feature scope.
- If an unresolved issue would require such a change, record it in `context/current_issues.md` with evidence and a proposed fix.

Never:
- rebuild green JDK internals from Family OS;
- introduce Trigger.dev for fast deterministic work;
- add a database merely to persist intermediate parser output;
- disable tests/lint/security gates to get GREEN.