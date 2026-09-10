# Unit 43 — Pinning the Postgres sslmode

## Status

v0 hardening. No new capability. Removes a future silent downgrade of the household database's
TLS verification.

## How this was found

Not by a test. By reading production.

Vercel runtime errors for dorandoran.link, 7-day window ending 2026-09-09:

```
(node:4) Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca'
are treated as aliases for 'verify-full'.
count=5  users=2  routes=/api/lifecycle/tasks, /api/lifecycle/candidates
first=2026-09-09T06:17  last=2026-09-09T16:02
```

Two things are in that line. The household is actually using the product — two real people hit
the lifecycle routes that day. And `pg` is warning that the meaning of the connection string is
about to change underneath it.

## The defect

`lib/server/lifecycle-store.ts` deliberately configures no TLS options and lets the injected URL's
own `sslmode` decide. Its comment recorded the consequence accurately:

> Note that pg currently treats `sslmode=require` as `verify-full` — it does validate the server
> certificate — not as an unauthenticated opportunistic-TLS mode.

That was true, and it was the whole problem. The word doing the work is **currently**. `verify-full`
was a property of the installed library version, not of the connection string. In
`pg` 9 / `pg-connection-string` 3 the same three modes adopt libpq semantics, where `require`
means "encrypt, but do not check who answered".

So the failure mode is: someone merges a dependency bump. No code changes. No error. Every test
green, `hyodo:check` 5/5, deployment READY. And the certificate of the database holding the
family's captures, candidates and tasks stops being verified. Nothing in the repository would say
so, because nothing in the repository asserted it in the first place.

`pg` is currently pinned at `8.23.0`.

*(Correction, same day: this line first read "…and a dependabot group PR is open", placed so it
implied that PR could bump `pg`. Measured afterwards: PR #4 bumps `next`, `postcss` and `lodash`
only, and is itself stale — it targets `next` 16.2.4→16.2.6 while main is on 16.3.4. The risk this
unit addresses is some future `pg` major, not any PR open today.)*

## The fix

`lib/server/postgres-connection.ts` — one pure function pair, no I/O.

`pinPostgresSslMode(connectionString)` rewrites an `sslmode` of `prefer`, `require` or `verify-ca`
to `verify-full`, and changes nothing else. It writes today's behaviour into the string, so the
meaning stops depending on which pg is installed. Production behaviour is unchanged: this asks pg
for exactly what pg already does.

`resolvePostgresConnectionString(env)` is the `DATABASE_URL || POSTGRES_URL` resolution that was
written three separate times, now written once, with the pinning attached so a call site cannot
forget it. Its three consumers:

- `lib/server/lifecycle-store.ts` — production, real household data
- `scripts/migrate.mjs` — schema migrations
- `scripts/drive-outbox-run.mjs` — the outbox trigger

## What it refuses to do

- **No `sslmode` in the string → untouched.** A local development database runs without TLS.
  Injecting `verify-full` where nobody asked for it would break the very behaviour this unit
  exists to preserve.
- **`disable` and `verify-full` → untouched.** Those are decisions, not ambiguity.
- **`uselibpqcompat` present → untouched.** That flag is the opt-in the warning itself offers.
  Overriding it would mean reversing a choice someone made on purpose.
- **The URL is not re-serialized.** It carries credentials, and parsing plus re-serializing can
  silently normalize percent-encoding. Only the `sslmode` value in the query is replaced; every
  other byte is preserved.
- **The libpq keyword/value form (`host=… sslmode=require`) passes through untouched.** Neon and
  Vercel emit URL form. Half-understanding the other form is worse than declaring it out of scope.

## Evidence

12 tests. Because this unit defends against a regression that cannot happen yet, passing tests are
not by themselves evidence that they defend anything — so the implementation was mutated three
ways and each mutation was confirmed to fail:

| Mutation | Failed |
|---|---|
| pin target `verify-full` → `require` | 5 tests |
| `uselibpqcompat` guard removed | 1 test |
| inject `sslmode` when the string has none | 4 tests |

630/630 tests, `hyodo:check` 5/5.

## What this unit does not settle

The production `DATABASE_URL` still says whatever it says. This unit makes the string's meaning
stable wherever it is read by this repository; it does not edit the Vercel environment variable,
which is a production mutation and the Commander's call.


## Proven against real Neon, 2026-09-09 (spec 45)

The claim this unit rested on — *pinning asks pg for exactly what pg already does, so production
behaviour is unchanged* — could not be shown by its tests. They compare strings; they cannot say
whether a real server accepts the pinned string.

The first production use answered it. The household's Neon connection string carries
`sslmode=require`; `pinPostgresSslMode` rewrote it to `sslmode=verify-full`, and the connection
**succeeded** against real Neon — schema read, migration applied, cursor written.

So the unit is now verified on both halves: the tests show the rewrite is exact and narrow, and
production shows the rewritten string is accepted by the server it was always meant for.
