# Unit 31 — Drive handoff intake (AI interop record → Capture / Artifact observation)

## Status

v0 pure, deterministic read model. No provider adapter, no Drive API call, no
persistence, no scheduler, no new dependency. A caller (route, script, or test)
supplies a parsed handoff record; this unit validates and maps it. Nothing here
creates a Candidate decision or a Task.

## Why

The Google Drive side of Family OS now has a provider-neutral contract:
`00_START_HERE_DORANDORAN_AI_README`, `MOC_00/10/20`, and
`DORANDORAN_HANDOFF_TEMPLATE` (2026-09-09). GPT, Gemini, Grok, Claude, JDK,
KINGDOM, and HyoDo hand off *small structured records*, while Drive keeps the
bytes. DoranDoran must receive those records into the existing lifecycle
(Unit 28) and artifact registry (Unit 30) without inventing state.

## Input contract — `DorandoranHandoffRecord` (from the Drive template)

| field | template values | required |
|---|---|---|
| `eventId` | stable unique id | yes |
| `occurredAt` | ISO-8601 | yes |
| `person` | `jay \| julie \| jayden \| family` | yes |
| `domain` | `career \| music \| kingdom \| family \| learning \| school \| admin \| other` | yes |
| `kind` | `capture \| decision \| final_artifact \| task_receipt \| learning_event \| calendar_change \| source_update` | yes |
| `privacyScope` | `personal \| family \| professional` | yes |
| `status` | `candidate \| reviewed \| final \| superseded \| archived \| informational` | yes |
| `sourceSystem` | `chatgpt \| gemini \| grok \| claude \| drive \| calendar \| jdk \| kingdom \| hyodo \| human` | yes |
| `sourceRefs` | string[] | optional, default `[]` |
| `driveFileId` | string | optional |
| `digest` | content digest string (e.g. `sha256:…`) | optional; required to feed the artifact registry |
| `evidenceRefs` | string[] | optional, default `[]` |
| `statedText` | what the human/source actually stated | yes, non-empty |
| `inference` | string | optional |
| `unknowns` | string[] | optional, default `[]` |
| `candidateSuggested` | boolean | yes |
| `requestedAction` | `none \| review \| accept_candidate \| schedule \| archive \| supersede` | yes |
| `notes` | string | optional |

Unknown extra fields are ignored. Any field of the wrong type fails closed.

## Output contract

```ts
parseDorandoranHandoff(input: unknown, context: { capturedBy: string; capturedAt: string }):
  | { ok: true; intake: HandoffIntake }
  | { ok: false; code: HandoffRejectCode; field?: string }
```

`HandoffIntake` (version 1):

- `capture` — a `CaptureEvent` candidate payload for Unit 28 (`id = eventId`,
  `personId`, `privacyScope`, mapped `kind`, `statedText`, mapped `source`,
  `occurredAt`, `capturedAt`, `capturedBy`, `evidenceRefs`, `unknowns`).
- `proposeCandidate: boolean` — `ACTIONABLE(mappedKind) AND (candidateSuggested === true
  OR (sourceSystem === 'human' AND requestedAction === 'accept_candidate'))`, where `ACTIONABLE`
  means the mapped capture kind is `want | decision | final_artifact`. The mapped kind must be
  actionable regardless of who is asking — a human `accept_candidate` on a non-actionable kind
  (e.g. `task_receipt`) still yields `proposeCandidate: false`.
- `artifact` — `ArtifactObservationInput` for Unit 30 when `kind === 'final_artifact'`
  AND `driveFileId` AND `digest` are present; otherwise `null`.
- `inference: string | null` — carried separately, never merged into `statedText`.
- `provenance` — `{ sourceSystem, domain, sourceRefs, driveFileId, status, requestedAction, notes }`
  kept verbatim for reconciliation; never used to decide anything in this unit.

### Kind mapping (Drive → Unit 28 `CaptureEvent['kind']`)

| Drive `kind` | capture kind | actionable |
|---|---|---|
| `decision` | `decision` | yes |
| `final_artifact` | `final_artifact` | yes |
| `capture` | `want` if `candidateSuggested`, else `fact` | conditional |
| `task_receipt`, `learning_event`, `calendar_change`, `source_update` | `fact` | never |

### Source mapping (Drive `sourceSystem` → `EvidenceRef['sourceType']`)

`drive → file`, `calendar → calendar`, `human → human`,
`chatgpt | gemini | grok | claude | jdk | kingdom | hyodo → system`.

### Person mapping

`jay | julie | jayden` → `personId` verbatim. `family` is not a lane in Unit 28;
a record with `person: 'family'` is accepted only when `privacyScope === 'family'`,
and its `personId` is `'family'`. Callers that persist must route it through the
family projection (Unit 28 §Privacy 3); this unit does not persist.

## Fail-closed rules (`HandoffRejectCode`)

- `FIELD_MISSING` / `FIELD_INVALID` — any required field absent, wrong type, or
  outside the enumerations above; `occurredAt` not parseable as a date.
- `ACCEPT_BY_AI_FORBIDDEN` — `requestedAction === 'accept_candidate'` with a
  non-`human` `sourceSystem`. AI may propose; it may never accept
  (Unit 28: *AI는 Candidate까지, Task는 사람*). A `human` source with
  `accept_candidate` and the request preserved in `provenance.requestedAction`
  contributes to `proposeCandidate` per the single rule in the Output contract
  above (it still requires an actionable mapped kind); the actual accept still
  goes through `decideCandidate` with a real session.
- `PRIVACY_PERSON_MISMATCH` — `person === 'family'` with a non-`family` scope,
  or `privacyScope === 'professional'` with `person === 'family'`.
- `SECRET_LIKE_CONTENT` — `statedText`, `inference`, or `notes` contains a
  token that looks like a credential: `AIza…` (Google API key), `sk-…` /
  `sk_live_…` (OpenAI/Stripe-style key), `ya29.…` (Google OAuth token),
  `AKIA…` (AWS access key id), `-----BEGIN` (PEM block), or `password=`/
  `passwd=`. Each key-shaped prefix requires a left word/hyphen boundary so
  ordinary hyphenated words (e.g. `task-1234567890`) never false-positive.
  The template forbids secrets; the adapter refuses rather than storing them.

## Privacy and evidence boundary

- Drive file bytes never enter this unit; only `driveFileId` and `digest`.
- `inference` is never written into `statedText`, `evidenceRefs`, or the
  artifact observation. It is carried as its own field so a reviewer can see it.
- `unknowns` are preserved verbatim; empty stays empty. Nothing is inferred to
  fill a gap.
- The artifact observation carries `state: 'confirmed'` only when
  `status === 'final'`; `reviewed | candidate` → `'unknown'`;
  `superseded | archived` → `'stale'`; `informational` → `'unknown'`.

## Out of scope

Drive API polling of `04_DORANDORAN_OUTBOX`, a `/api/lifecycle/handoff` route,
persistence, dedup across repeated `eventId`s, Julie-lane isolation policy,
`child-controlled` scope (the README lists it; Unit 28 has no such scope — see
the reconciliation note in bb), and any UI.

## Reconciliation findings to feed back to the Drive contract owner

1. README "minimum handoff shape" (`personId`, `type`, `title`, `sourceRef`,
   `statedWhy`) and `DORANDORAN_HANDOFF_TEMPLATE` (`person`, `kind`,
   `statedText`, `sourceRefs`) disagree on field names. This unit implements
   the template; the README block should be aligned to it.
2. README lists `child-controlled` privacy scope; the template and Unit 28
   have only `personal | family | professional`.
3. The template has no content `digest`; without it a `final_artifact` cannot
   enter the Unit 30 registry (which requires a digest to detect conflicts).
   This unit accepts an optional `digest` and recommends the template add it.
4. Template `status` (`candidate | reviewed | final | …`) overlaps in name but
   not meaning with Unit 28 `CandidateState`; this unit keeps it in
   `provenance.status` and does not map it to a candidate decision.
