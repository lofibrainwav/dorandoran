# 06 — All-day Truth + Calendar Reconciliation

Goal: stop silently dropping all-day calendar truth and prepare multiple authorized calendar sources without inventing equivalence.

Rules:
- Google all-day `start.date` / `end.date` are preserved; end date is exclusive.
- All-day truth is shown in a dedicated week row, not forced into timed coordinates.
- Multiple calendar sources may coexist in one week.
- Do not deduplicate two events merely because titles/times look similar.
- Source/evidence identity survives normalization and decomposition.
- Provider/email override reconciliation remains a later layer.
