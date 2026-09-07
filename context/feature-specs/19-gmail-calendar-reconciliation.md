# 19 — Gmail + Calendar Reconciliation

Goal: combine protected Calendar truth with verified provider facts without mutating either source.

Rules:
- Every provider fact used here must have an explicit targetEventId.
- A claim targeting another event fails closed.
- Calendar facts are generated only from explicit normalized fields: start, end, location, recurrence.
- Provider facts reconcile only against the same fact kind.
- Direct provider facts can override lower-tier Calendar facts under the existing source-rank law.
- Cancellation is not invented from Calendar absence; it exists only when a source explicitly claims it.
- Reconciled reality is a projection; original Calendar and Gmail source objects remain unchanged.
- Private Gmail text never appears in the reconciled projection.
- Protected Calendar status remains protected after reconciliation.
