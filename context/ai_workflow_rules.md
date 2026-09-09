# AI Workflow Rules

Core lifecycle principle:
- AI는 Candidate까지, Task는 사람. (see `context/feature-specs/28-core-lifecycle.md`)

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

External action authority:
- Read, analyze, generate, and private storage may be automated only within their existing scope and privacy rules.
- The canonical per-action human-gate matrix currently includes `gmail/send`, `files/share`, `payments/execute`, and `publishing/publish`.
- Standing consent can never promote one of those consequential actions to `auto`; the action must stop at a human gate.
- `email_send` additionally requires a current, unconsumed adult-human approval bound to the exact action, recipient fingerprint, and content fingerprint. Changing recipient or content invalidates approval.
- An agent, automation, scheduler, test, preview, or system process can never approve an email send on behalf of a person.
- Test, preview, acceptance, rehearsal, and dry-run paths are read-only and must perform zero external sends.
- If an email send outcome is uncertain, stop. Never retry merely to obtain a successful readback.
- Calendar writes and private file writes retain their existing domain policies; they are not silently promoted into this matrix.
- Invitations, filings, job/application submissions, purchases, or other new consequential external actions require an explicit authority policy before automation is added.

Drift control:
- one active feature spec at a time
- do not rewrite verified core when shell/config is the failing layer
- record real blockers in `context/progress_tracker.md`
