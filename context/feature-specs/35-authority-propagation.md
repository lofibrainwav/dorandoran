# Unit 35 — Authority propagation (human acceptance → machine-readable grant)

## Status

v0 pure, deterministic. No I/O, no clock, no crypto import, no persistence. The hash
function is injected, so this unit stays inside `lib/family-os`'s browser-safe contract
(that directory imports zero `node:` modules today).

## Why

Unit 28 already records who accepted what: `decideCandidate` refuses `by === 'chad'`,
requires an `evidenceRef`, and stamps `at`. And `taskFromAcceptedCandidate` already accepts
an `authorityRef`. But that field is a bare `string?` with **no validation of any kind** —
the seat for authority exists and is empty.

The observed failure this fills: a human approves something in conversation, and nothing
carries that approval to the machine that must decide whether an action is allowed. The
approval has to be re-obtained at every downstream gate, which reads to the human as
"I already told you". The fix is not to weaken the gate — an unclassified action must still
stop — but to make the existing approval *legible* to it.

## What a grant binds

An approval that binds nothing is a blank cheque. A grant therefore pins **what** and
**where**, and its own hash:

```ts
interface AuthorityScope {
  action: string                 // the single verb this approval covers
  resources: readonly string[]   // the things it may touch
}
```

`canonicalAuthorityScope` normalizes to `action + '\n' + sorted-deduped resources joined by '\n'`.
Sorting and dedup make the digest independent of caller ordering; the same normalization rule
as KINGDOM's `scopeHash` so a grant minted here stays verifiable downstream.

The digest is computed by an **injected** `digest(canonical) => string`. This unit never
imports crypto and never invents a digest of its own.

## Grant

```ts
grantAuthorityFromAcceptedCandidate({ candidate, taskId, scope, expiresAt, nonce, digest })
  => AuthorityGrant
```

- Refuses a candidate that is not accepted (`CANDIDATE_NOT_ACCEPTED`), reusing Unit 28's word.
- Copies `grantedBy`/`grantedAt`/`evidenceRef` from the human decision — it never authors them.
- `expiresAt` is required. An approval without an end is a standing permission, which is
  exactly what "a human decides each consequential action" forbids.

## Evaluation

```ts
evaluateAuthority({ grant, request, now, consumedNonces, digest })
  => { ok: true; ref } | { ok: false; reason; detail? }
```

Checked in this order, all fail-closed:

| reason | when |
|---|---|
| `GRANT_MISSING` | no grant supplied — absence is never permission |
| `GRANT_NOT_HUMAN` | `grantedBy` blank or `chad`; AI cannot author authority |
| `SCOPE_DIGEST_MISMATCH` | recomputed digest ≠ the pinned `scopeDigest` |
| `EXPIRED` | `now > expiresAt` |
| `NONCE_REPLAYED` | this nonce was already consumed |
| `ACTION_MISMATCH` | requested action ≠ granted action |
| `RESOURCE_OUTSIDE_SCOPE` | any requested resource outside the granted set (`detail` names them) |

A request naming **no** resource is `RESOURCE_OUTSIDE_SCOPE`, not a pass: an unnamed target is
inside no scope, and admitting it would make the scope check meaningless.

`SCOPE_DIGEST_MISMATCH` is checked before the scope comparison on purpose. If the digest and
the scope disagree, one of them was edited after signing, and comparing the edited scope would
answer the wrong question.

An unknown request is a `STOP`, not a pass: every reason above denies. This unit narrows how
often a human must be asked; it never removes the asking.

## Ref

On success the unit returns `authority:v1:<taskId>:<nonce>`, the value meant for
`FamilyBlock.authorityRef`. It is an audit handle, not a secret: it names which task and
which single-use grant admitted the action, so a reviewer can find both.

## Out of scope

Persisting grants or consumed nonces, a signature layer (this unit checks binding, not
provenance of a key), Linear/GitHub gate wiring, KINGDOM executor integration, revocation
before expiry, and any UI.
