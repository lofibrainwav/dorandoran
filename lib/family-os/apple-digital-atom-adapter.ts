import type { ContextAdapter, ContextObservationInput, SixW1HEnvelope } from './universal-context.ts'
import type { AppleDigitalAtomBatch, AppleDigitalAtomEvent } from './apple-digital-atom.ts'

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function timestamp(value: unknown): string | undefined {
  const normalized = text(value)
  if (!normalized || Number.isNaN(Date.parse(normalized))) return undefined
  return new Date(normalized).toISOString()
}

function sourceRef(batch: AppleDigitalAtomBatch, event: AppleDigitalAtomEvent): string {
  return `apple:${batch.source}:${batch.deviceId}:${event.eventId}`
}

function sixW1H(batch: AppleDigitalAtomBatch, event: AppleDigitalAtomEvent): SixW1HEnvelope {
  const metadata = event.metadata
  if (batch.source === 'calendar') {
    const start = timestamp(metadata.start)
    const end = timestamp(metadata.end)
    const timeZone = text(metadata.timeZone)
    const location = text(metadata.location)
    const title = text(metadata.title)
    return {
      ...(title ? { what: { label: title } } : {}),
      ...(start || end || timeZone ? { when: { ...(start ? { start } : {}), ...(end ? { end } : {}), ...(timeZone ? { timeZone } : {}) } } : {}),
      ...(location ? { where: { label: location } } : {}),
    }
  }

  if (batch.source === 'reminders') {
    const title = text(metadata.title)
    const dueAt = timestamp(metadata.dueAt)
    return {
      ...(title ? { what: { label: title } } : {}),
      ...(dueAt ? { when: { start: dueAt } } : {}),
    }
  }

  if (batch.source === 'shortcuts') {
    const actionId = text(metadata.actionId)
    const shortcutName = text(metadata.shortcutName)
    const label = [shortcutName, actionId].filter(Boolean).join(' · ')
    const completedAt = timestamp(metadata.completedAt)
    return {
      ...(label ? { what: { label } } : {}),
      ...(completedAt ? { when: { start: completedAt } } : {}),
    }
  }

  const accessoryLabel = text(metadata.accessoryLabel)
  const state = text(metadata.state)
  const roomId = text(metadata.roomId)
  return {
    ...((accessoryLabel || state) ? { what: { label: [accessoryLabel, state].filter(Boolean).join(' · ') } } : {}),
    ...(roomId ? { where: { placeRef: `apple-home-room:${roomId}` } } : {}),
  }
}

function observation(batch: AppleDigitalAtomBatch, event: AppleDigitalAtomEvent): ContextObservationInput {
  const observedAt = timestamp(batch.sentAt)
  const occurredAt = timestamp(event.occurredAt)
  if (!observedAt || !occurredAt) throw new Error('APPLE_ATOM_TIMESTAMP_INVALID')
  const ref = sourceRef(batch, event)
  return {
    id: ref,
    kind: `apple.${batch.source}.${event.kind}`,
    sixW1H: sixW1H(batch, event),
    sourceRef: ref,
    observedAt,
    evidenceState: event.operation === 'delete' ? 'stale' : 'confirmed',
    evidenceRefs: [`evidence:${ref}`],
    continuity: { recordedAt: occurredAt, priorObservationRef: batch.cursor },
  }
}

export function normalizeAppleDigitalAtomBatch(batch: AppleDigitalAtomBatch): ContextObservationInput[] {
  return batch.events.map((event) => observation(batch, event))
}

export const appleDigitalAtomAdapter: ContextAdapter<AppleDigitalAtomBatch> = {
  id: 'family.apple-digital-atom.v1',
  inputKind: 'apple.digital-atom.batch',
  normalize: normalizeAppleDigitalAtomBatch,
}
