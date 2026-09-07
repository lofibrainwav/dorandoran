import type { SixW1HKey } from './universal-context.ts'

export type TimeScale = 'now' | 'today' | 'week' | 'month' | 'year' | 'past'
export type SpaceScale = 'world' | 'region' | 'local' | 'place'
export type FocusScale = 'family' | 'person' | 'activity' | 'domain'

export const YEONG_TIME_AXIS: readonly TimeScale[] = ['past', 'year', 'month', 'week', 'today', 'now']

export interface ZoomState {
  time: TimeScale
  space: SpaceScale
  focus: FocusScale
  focusRef?: string
}

export function makeZoomState(state: ZoomState): ZoomState {
  return { ...state }
}

export function disclosureForZoom(state: ZoomState): SixW1HKey[] {
  if (state.time === 'now' || state.time === 'today') return ['who', 'what', 'when', 'where']
  if (state.time === 'week') return ['who', 'what', 'when']
  if (state.time === 'month') return ['what', 'when']
  if (state.time === 'year' || state.time === 'past') return ['what', 'when', 'where']
  return ['what', 'when']
}

export function zoomTowardPerson(state: ZoomState, personId: string): ZoomState {
  if (!personId.trim()) throw new Error('personId is required')
  return { ...state, focus: 'person', focusRef: personId }
}
