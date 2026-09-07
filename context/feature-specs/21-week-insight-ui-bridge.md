# 21 — Week Insight UI Bridge

Goal: attach privacy-safe Chad insights to the correct Family Week event card.

Rules:
- UI matching uses canonical Calendar evidence identity, never raw Google event id alone.
- Different calendars with the same provider event id remain distinct.
- Confirmed/quiet insights render no warning badge.
- Changed, cancelled, recover, and action states get small status labels only.
- UI labels do not expose source text or sender identity.
- This bridge is presentation-only and cannot mutate Calendar, Gmail, or Goal state.
