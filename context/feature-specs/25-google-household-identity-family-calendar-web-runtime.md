# Unit 25 — Google Household Identity + Family Calendar Web Runtime

## Goal
Replace the custom DoranDoran site-password gate with Google identity **only after** the new Preview flow is end-to-end verified, while preserving Family OS truth/privacy boundaries.

## Truth boundaries
- Google sign-in proves identity; it does not make Google the Family OS SSoT.
- Google `sub` is the canonical external identity key. Email is display metadata, not the authorization key.
- Household membership is explicit configuration. Unknown Google identities fail closed.
- Child identities may exist in the household graph without receiving management-surface login authority.
- Google Calendar events remain source evidence. Calendar membership never implies event subject.
- Calendar subject mapping is deterministic and explicit. No title/AI inference may silently assign a family member.
- Unknown calendar events remain `unassigned`.
- The operational family calendar is configured by immutable calendar ID, never by its display name.
- Google OAuth credentials, Google subject IDs, account emails, calendar IDs, and private event IDs must not be committed to the public repository.

## Runtime model

### 25A Google Identity
A future web adapter verifies a Google ID token and emits only normalized identity claims required by Family OS.

### 25B Household Membership
`DORANDORAN_HOUSEHOLD_MEMBERS_JSON` provides explicit members:

```json
[
  {"personId":"adult-a","googleSub":"...","access":"adult","roles":["admin","transport"]},
  {"personId":"adult-b","googleSub":"...","access":"adult","roles":["admin","scheduler"]},
  {"personId":"child-a","googleSub":"...","access":"child","roles":["child"]}
]
```

The repository contains no real household identifiers.

### 25C Web Calendar Credential Provider
The existing local file OAuth transport remains valid for private/local runtime. A separate Vercel-safe web credential provider will be added; it must not depend on local file paths.

### 25D Operational Calendar Mapping
`DORANDORAN_FAMILY_CALENDAR_ID` selects the live family operations source by immutable ID. Calendar display names are ignored.

### 25E Event Subject Resolver
`DORANDORAN_CALENDAR_SUBJECT_RULES_JSON` maps explicit event or recurring-series IDs to Family OS `personId`s. Example shape:

```json
[
  {"kind":"series","sourceId":"opaque-series-id","personId":"child-a"}
]
```

Priority is exact event rule, then exact recurring-series rule. No fuzzy/title matching.

### 25F Responsibility Policy
Scheduler/transport defaults are a separate family policy, never inferred from the calendar event itself.

### 25G Role-aware Today Projection
The same canonical family observations can project different action emphasis for each signed-in adult without changing source truth.

### 25H Password Gate Retirement — DONE 2026-09-08
Completed after both approved adults signed in on Production with Google identity:
- removed `/unlock` and `/api/site-unlock`
- removed `site-password-gate.ts` and its tests
- removed `DORANDORAN_ACCESS_CODE` and `DORANDORAN_GATE_KEY` from Production env (2026-09-08)
- removed one-time `__dd_session` logic; `proxy.ts` now fails closed to 503 when identity configuration is incomplete and otherwise redirects to `/signin`

## Rollout order
1. Pure household membership + subject resolver contracts and tests.
2. Google web identity adapter on Preview.
3. Vercel-safe household Calendar credential provider.
4. Role-aware Today projection.
5. Preview browser E2E with approved adults and denied unknown/child identities.
6. HyoDo/CI GREEN.
7. Retire password gate. (done 2026-09-08)
8. Promote exactly one verified deployment to `dorandoran.link`.

## Non-goals
- No Calendar data migration.
- No requirement that family members change how they currently schedule.
- No Gmail/Drive write access in this unit.
- No Gemini coupling to authentication. Gemini remains a provider behind the Family AI boundary.
