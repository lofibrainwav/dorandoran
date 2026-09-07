# 07 — Multi-account Calendar Sources

Goal: combine authorized Family and Jayden calendar truth without sharing credentials or inventing equivalence.

Rules:
- each account/source has its own token path and calendar identity;
- source failure degrades to PARTIAL, not silent success or total failure;
- source evidence remains namespaced through FamilyBlock ids;
- matching titles/times are never auto-deduplicated;
- local credentials remain repo-external and read-only;
- legacy single-source env remains a compatibility fallback only.