# Project Overview Router

Canonical product intent: `docs/family-os/PRD-v0.2.md`.
Canonical contract semantics: `docs/family-os/CONTRACTS-v0.2.md`.
Canonical golden scenarios: `docs/family-os/TDD-v0.2.md`.
Canonical JDK boundary: `docs/family-os/JDK-INTEGRATION-v0.1.md`.

Current product shape:
- One-Box = time-block/calendar engine.
- Chad = orchestrator and resolver.
- Family Calendar = calendar-first interface.
- JDK = separate private learning runtime behind a versioned bridge.

Current build target: prove calendar ingestion/decomposition before persistence or broad automation.
Out of scope for this unit: database migration, monorepo consolidation, notification-intelligence engine, photo/memory system, live GPS, JDK rebuild.