# Unit 33 — Artifact digest validation

## Status

Pure validation hardening on two existing layers (Unit 31 intake, Unit 30 registry).
No new module, no I/O, no dependency. Behaviour change is narrow: a digest that is
*present but malformed* now fails closed instead of flowing through.

## Why

The Drive contract (`00_START_HERE_DORANDORAN_AI_README`, `DORANDORAN_HANDOFF_TEMPLATE`,
`MOC_10_JAY`, `MOC_20_SHARED_PROJECTS`, 2026-09-09) states:

> `kind=final_artifact`: `digest: sha256:<hex>` REQUIRED.
> Without a **valid** digest, Artifact Registry entry is prohibited.

Before this unit the code enforced only *presence*: `readOptionalString` (intake) and
`requiredString` (registry) accept any non-blank string. `digest: "not-a-hash"` reached
the registry and could be promoted to `state: 'confirmed'`. The contract word that was
unimplemented is **valid**.

Reconciliation record: `bb 02-Projects/kingdom-os/dorandoran/2026-09-09-drive-contract-reconciliation.md` §5.

## Contract

```
VALID_DIGEST = /^sha256:[0-9a-f]{64}$/
```

Lowercase hex only. `sha256:` is the sole accepted algorithm prefix — the Drive contract
names exactly one, and accepting a second here would out-run the contract.

### Layer 1 — Unit 31 intake (`parseDorandoranHandoff`)

| input | before | after |
|---|---|---|
| `digest` absent | ok, `artifact: null` when `final_artifact` | unchanged |
| `digest` present, valid | ok, artifact carries it | unchanged |
| `digest` present, blank/whitespace | `FIELD_INVALID` | unchanged |
| `digest` present, malformed | **ok, flows to registry** | **`FIELD_INVALID` (field `digest`)** |

A malformed digest is a wrong-shaped field, so it reuses the existing `FIELD_INVALID`
code rather than introducing a new reject code. The record is rejected whole — not
silently downgraded to "no artifact" — because the sender asserted a digest and got it
wrong; swallowing that produces a Capture whose provenance quietly lost a claim.

### Layer 2 — Unit 30 registry (`buildArtifactRegistry` → `normalize`)

| input | before | after |
|---|---|---|
| `digest` missing/blank | throws `ARTIFACT_DIGEST_REQUIRED` | unchanged |
| `digest` malformed | **accepted** | **throws `ARTIFACT_DIGEST_INVALID`** |

The registry keeps its own check rather than trusting the caller. Today intake is its only
producer; Unit 34 (Outbox wiring) adds another path, and the contract names the *registry*
as the thing an invalid digest may not enter.

## Absence is still not rejection

`kind: 'final_artifact'` **without** a digest stays `ok: true` with `artifact: null`, as
before. The contract prohibits the *registry entry*, and that prohibition is already met by
producing no observation. Such a record is still a legitimate Capture — the fact that a
final artifact exists is worth recording even when the sender could not compute a hash.

## Out of scope

Computing digests, verifying a digest against Drive file bytes, other hash algorithms,
digest rotation/migration of already-stored registries, and any UI.
