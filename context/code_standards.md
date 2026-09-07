# Code Standards

- Prefer pure functions in `lib/family-os`.
- Preserve evidence identity and UNKNOWN states; do not invent certainty.
- Keep external source parsing at explicit adapter boundaries.
- Client components receive minimal privacy-safe projections only.
- Avoid new dependencies until a feature spec proves they are needed.
- Use explicit package versions for the Greenfield baseline.
- Mobile and reduced-motion behavior are first-class acceptance criteria.
- Accessibility semantics must not depend on canvas/WebGPU content.
- No secret, token, email body, address, or private family fixture in public tests.
- Every completed unit must pass HyoDo plus the underlying deterministic gates.
