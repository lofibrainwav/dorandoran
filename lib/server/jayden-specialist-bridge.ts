import {
  evaluateJdkReleaseTransport,
  type JdkReleaseTransportSignals,
} from '../family-os/jdk-exact-bridge.ts'
import type { SpecialistModuleSummary } from '../family-os/family-operating-read-model.ts'

export function projectJaydenLearningModule(
  signals: JdkReleaseTransportSignals,
): SpecialistModuleSummary {
  const decision = evaluateJdkReleaseTransport(signals)
  if (decision.state === 'ready') {
    return {
      id: 'learning',
      label: 'Learning',
      state: 'ready',
      statusLabel: 'Connected',
      reasonCodes: [],
    }
  }
  return {
    id: 'learning',
    label: 'Learning',
    state: 'blocked',
    statusLabel: 'Bridge pending',
    reasonCodes: [...decision.reasons],
  }
}
