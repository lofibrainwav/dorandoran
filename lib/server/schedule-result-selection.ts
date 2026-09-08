interface ScheduleLike {
  sourceHealth: 'green' | 'partial' | 'failure'
}

/**
 * Prefer the operational family calendar, but never let a failed read hide a healthy fallback source.
 * A failed operational result only wins when there is nothing else to show.
 */
export function selectScheduleResult<A extends ScheduleLike, B extends ScheduleLike>(
  operational: A | null,
  fallback: B | null,
): A | B | null {
  if (operational && operational.sourceHealth !== 'failure') return operational
  if (fallback) return fallback
  return operational
}
