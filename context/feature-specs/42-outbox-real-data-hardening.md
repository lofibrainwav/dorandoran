# Unit 42 — Hardening from the first real Drive read

## Status

v0 correction. No new capability; four defects that only a real read could expose.

## How these were found

The Drive lane was complete and every layer green, but nothing had ever read the real folders.
Reading them (2026-09-09) showed two facts no test had assumed:

1. All three `04_DORANDORAN_OUTBOX` folders contain exactly one file — the
   `DORANDORAN_HANDOFF_TEMPLATE` itself. There are no handoff records yet.
2. The template's text carries a filled-in **EXAMPLE** section (`person: jay`,
   `privacyScope: personal`) *after* its placeholder section, and Drive returns placeholders
   escaped as `\<jay | julie\>` through at least one client.

Running the real text through the pipeline: it was rejected — but only because `eventId` was
missing. Everything else survived parsing, including `statedText: "\<final artifact statement\>"`.
Fill in one field and the rest of the template's scaffolding would have entered the household as
a record.

## Four corrections

### 1. The template file is not a record

`planDriveOutboxIntake` skips files whose name matches the handoff template
(`DORANDORAN_HANDOFF_TEMPLATE`, case-insensitive), with reason `template_file`.

This is the root fix: the template lives in the outbox by design — that is where an agent finds
it — so it will be listed on every single run, forever. Reading it was never intended.

### 2. Placeholders survive escaping and prefixes

Was: `/^<.*>$/` — only a bare `<…>` spanning the whole value.

Now a value is a placeholder if, after removing backslash escapes, it **contains** a `<…>` group.
That catches `\<jay | julie\>` (escaped) and `sha256:<hex>` (prefixed), both observed in the real
file and both previously accepted as real values.

### 3. `[]` is an empty list, not an item

`unknowns: []` in the template produced `unknowns: ["[]"]` — the notation for "nothing" became a
thing. A list item that is `[]` (escaped or not) is now dropped.

### 4. Later sections no longer overwrite earlier ones silently

The template states each field twice: once as a placeholder, once in EXAMPLE. Sequential parsing
let EXAMPLE win. With corrections 1–3 the EXAMPLE values that survive are only the two literal
ones (`person: jay`, `privacyScope: personal`), and with correction 1 the file is not read at all —
but a **copied** template still carries its EXAMPLE section, so first-write-wins is now explicit:
a field already set is not overwritten.

That direction is deliberate. The HANDOFF RECORD section comes first in the template, so
first-write-wins keeps what the sender filled in and discards the specimen below it.

## What did not change

No validation moved into the parser. Unit 31 still decides whether a value is acceptable; this
unit only stops scaffolding from being mistaken for content.

## Honest note on the escape observation

The escaped form was observed through one Drive client. A different client may return unescaped
text — the plain form was tested too, and both are handled. The correction does not depend on
which client is used, which is the point.
