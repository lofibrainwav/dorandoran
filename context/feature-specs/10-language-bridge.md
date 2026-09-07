# 10 — Family Language Bridge

Goal: preserve English source truth while giving Korean meaning and a separate family-style reply layer.

Rules:
- original source is referenced, never overwritten by translation;
- translation, extracted actions, deadlines, and uncertainty are separate fields;
- reply tone/profile is downstream from facts, never evidence itself;
- missing source reference fails closed;
- generated reply may be omitted without losing the translated meaning;
- public tests use generic text only.