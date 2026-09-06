# UI Context

Domain requirement:
- Calendar first; Sunday is the leftmost day.
- Weekly view is a time grid, not a generic dashboard.
- Calendar events are primary blocks; child tasks appear by decomposition.
- Owner color and status/risk color are separate semantic layers.
- Keep family-facing UI simple, calm, and concrete.

Source-backed presentation guidance:
- Reuse components instead of recreating card/layout primitives.
- Use dynamic viewport units where they reduce mobile layout shift.
- Avoid decorative motion that competes with the product's primary purpose.
- Keep heavy pointer/tilt interactions out of touch-first layouts.

Project decisions:
- Chad = blue; Julie = green; Jayden = light green; Jay Physical = orange; Together = purple.
- Confirmed/hold = green accent; risk/tight = amber/yellow.
- Week/Month/Year are zoom levels over the same underlying block data, not separate copied datasets.