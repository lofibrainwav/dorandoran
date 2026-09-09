# Planner Recommendations

## Contract

The Family Week planner may show up to three currently placeable wishes by adapting
the existing `rankNextBestBlockOptions` result. A recommendation is a suggestion,
not an external calendar write. It carries the wish id, title, owner, and the
ranker's label, typed fit/friction reasons, and confidence.

Recommendations use the duration currently present in the planner wish, including
the user's local duration override. Unknown planner availability, an empty week,
an empty gap set, or a wish that the existing scheduler cannot place produces no
recommendation.

## Selection and placement

The user explicitly chooses one recommendation. Only then does the client perform
the existing no-store availability refresh and call
`schedulePlannerWishes([selectedWish], latestModel, existingPlans)`. A refresh or
placement failure preserves the existing localStorage draft. The existing
calendar, external-write, and ICS contracts remain unchanged.

The recommendation panel uses Korean client copy, exposes status through the
planner's existing polite live status, and remains horizontally safe on mobile.
