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

External action authority:
- Read, analyze, generate, and private storage may be automated only within their existing scope and privacy rules.
- `email_send` is a human authority boundary. An agent, automation, scheduler, test, preview, or system process can never approve an email send on behalf of a person.
- A valid email-send approval must be explicit, current, unconsumed, and bound to the exact action, recipient fingerprint, and content fingerprint. Changing the recipient or content invalidates the approval.
- Test, preview, acceptance, rehearsal, and dry-run paths are read-only and must perform zero external sends.
- If an email send outcome is uncertain, stop. Never retry merely to obtain a successful readback.
- Other consequential external actions such as invitations, filings, submissions, purchases, or public posts require their own explicit authority policy before automation.

Drift control:
- one active feature spec at a time
- do not rewrite verified core when shell/config is the failing layer
- record real blockers in `context/progress_tracker.md`
