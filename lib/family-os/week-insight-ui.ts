import type { WeekEventInsight } from './week-insight.ts'

export type WeekInsightBadgeTone = 'info' | 'danger' | 'muted' | 'warning'

export interface WeekInsightBadge {
  label: 'Updated' | 'Cancelled' | 'Checking' | 'Needs prep'
  tone: WeekInsightBadgeTone
}

export function weekInsightBlockId(insight: WeekEventInsight): string | null {
  const target = insight.targetEventId?.trim()
  if (!target?.startsWith('calendar:')) return null
  const identity = target.slice('calendar:'.length)
  return identity ? `event:${identity}` : null
}

export function weekInsightBadge(insight: WeekEventInsight): WeekInsightBadge | null {
  if (insight.state === 'confirmed') return null
  if (insight.state === 'changed') return { label: 'Updated', tone: 'info' }
  if (insight.state === 'cancelled') return { label: 'Cancelled', tone: 'danger' }
  if (insight.state === 'recover') return { label: 'Checking', tone: 'muted' }
  return { label: 'Needs prep', tone: 'warning' }
}
