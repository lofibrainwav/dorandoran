# Unit 36 — Drive Outbox record parsing (+ `drive.readonly` scope)

## Status

v0 pure, deterministic. No network call, no OAuth flow, no persistence. Turns the *text* of an
outbox file into the object Unit 31 already knows how to validate, and adds the Drive scope the
transport half will need.

## Why

Unit 34 walks the outbox and decides what to read; Unit 31 validates a record object. Between
them sits a gap nothing fills: an outbox file is **text**, and no code turns that text into a
record. The gap is why the Drive lane still cannot flow end to end.

`google-source-scopes` also has no `drive` entry, so an OAuth grant cannot even request read
access to the folder.

## Scope wiring

`GoogleReadOnlyService` gains `drive` → `https://www.googleapis.com/auth/drive.readonly`.

The service check currently hardcodes `service !== 'calendar' && service !== 'gmail'`, which
means every new service needs an edit in two places and silently accepts nothing if one is
missed. It becomes a lookup against the scope table itself — one source of truth.

Read-only is the whole grant. Unit 34's plan is read-then-classify; nothing in this lane writes
to Drive, and asking for write access we do not use would be a standing permission.

## Two payload shapes, one output

The Drive contract shows the record in two forms, and both are legitimate senders:

- **JSON** — the README's canonical handoff block. `mimeType: application/json`, or text that
  starts with `{`.
- **Template text** — `DORANDORAN_HANDOFF_TEMPLATE` as filled in by a human or an agent:
  `key: value` lines, with `key:` followed by `- item` lines for lists.

`parseOutboxRecordText(text, { mimeType })` returns a plain object for either, or throws
`INVALID_OUTBOX_RECORD_TEXT` when the text yields no recognizable field.

### Why the template parser reads a whitelist

The template file is not only a record — it also carries prose, section headers, and lines like
`LAST UPDATED: 2026-09-09`. A naive `key: value` scan would lift that date into a field named
`LAST UPDATED`, and a sender's stray sentence containing a colon would become another.

So the parser extracts **only the field names Unit 31 knows**:

```
eventId occurredAt person domain kind privacyScope status sourceSystem
sourceRefs driveFileId digest evidenceRefs statedText inference unknowns
candidateSuggested requestedAction notes
```

Everything else is ignored, exactly as Unit 31 ignores unknown extra fields. The parser never
invents a field, and never renames one.

### Typed values

The template is text, so `candidateSuggested: true` arrives as the string `"true"`. The parser
converts only where Unit 31's contract is unambiguous:

- `candidateSuggested` — `true`/`false` (case-insensitive) become booleans; anything else is
  passed through unchanged so Unit 31 rejects it as `FIELD_INVALID` rather than this unit
  guessing.
- List fields (`sourceRefs`, `evidenceRefs`, `unknowns`) — always arrays, `[]` when the key is
  present with no items.
- Everything else stays a string.

Unfilled placeholders (`<jay | julie | ...>`) are dropped rather than passed on: an untouched
template slot is not a stated value, and forwarding it would let `<...>` reach `statedText`.

## Fail-closed rules

- Text that parses to zero known fields → `INVALID_OUTBOX_RECORD_TEXT`. An empty result is not
  an empty record.
- Malformed JSON → `INVALID_OUTBOX_RECORD_TEXT`, never a silent fallback to the template parser:
  a sender that declared JSON and got it wrong should be told, not guessed at.
- JSON that is an array or scalar → `INVALID_OUTBOX_RECORD_TEXT`. One file, one record.
- This unit performs **no** validation of field values. That is Unit 31's job, and duplicating it
  here would create two places for the contract to drift.

## Out of scope

The Drive API call itself, OAuth token exchange, persistence of processed sets, a polling route
or scheduler, and any UI.
