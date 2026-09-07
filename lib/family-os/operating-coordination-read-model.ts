import type { HandoffContract, JobMode } from './contracts.ts'
import type { WeekEventInsight, WeekInsightHint } from './week-insight.ts'
import { weekInsightBadge, type WeekInsightBadgeTone } from './week-insight-ui.ts'

export interface OperatingWatchProjection {
  state: 'changed' | 'cancelled' | 'recover' | 'action'
  label: 'Updated' | 'Cancelled' | 'Checking' | 'Needs prep'
  tone: WeekInsightBadgeTone
  hints: WeekInsightHint[]
  evidenceRefs: string[]
}

export interface OperatingHandoffProjection {
  id: string
  state: HandoffContract['state']
  fromMode: JobMode
  toMode: JobMode
  evidenceRefs: string[]
}

export function projectOperatingWatch(insight: WeekEventInsight): OperatingWatchProjection | null {
  if (insight.state === 'confirmed') return null
  const badge = weekInsightBadge(insight)
  if (!badge) return null
  return {
    state: insight.state,
    label: badge.label,
    tone: badge.tone,
    hints: [...insight.hints],
    evidenceRefs: [...insight.evidenceRefs],
  }
}

export function projectOperatingHandoff(handoff: HandoffContract): OperatingHandoffProjection {
  return {
    id: handoff.id,
    state: handoff.state,
    fromMode: handoff.fromMode,
    toMode: handoff.toMode,
    evidenceRefs: [...handoff.evidenceRefs],
  }
}
