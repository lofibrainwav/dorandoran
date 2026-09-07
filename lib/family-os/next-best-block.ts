import type { CapacitySnapshot, NextBestBlockOption, Opportunity } from './contracts.ts'

const level = { low: 1, medium: 2, high: 3 } as const

function labelFor(opportunity: Opportunity): NextBestBlockOption['label'] {
  if (opportunity.kind === 'rest') return 'rest'
  if ((opportunity.estimatedMinutes ?? Infinity) <= 20 && opportunity.priority !== 'low') return 'quick_win'
  if (opportunity.priority === 'high') return 'important'
  if (opportunity.growthValue === 'high') return 'growth'
  return 'other'
}

function totalMinutes(opportunity: Opportunity): number | undefined {
  if (opportunity.estimatedMinutes == null) return undefined
  return opportunity.estimatedMinutes + (opportunity.setupMinutes ?? 0) + (opportunity.transitionMinutes ?? 0)
}

function matchingObservations(opportunity: Opportunity, capacity: CapacitySnapshot) {
  const tags = new Set(opportunity.tags ?? [])
  return (capacity.observations ?? []).filter((observation) => observation.tags.some((tag) => tags.has(tag)))
}

export function rankNextBestBlockOptions(
  opportunities: Opportunity[],
  capacity: CapacitySnapshot,
): NextBestBlockOption[] {
  const tools = new Set(capacity.availableTools ?? [])
  return opportunities
    .map((opportunity) => {
      const frictionReason: string[] = []
      const fitReason: string[] = []
      const total = totalMinutes(opportunity)

      if (total == null) frictionReason.push('DURATION_UNKNOWN')
      else if (total > capacity.availableMinutes) frictionReason.push('TIME_DOES_NOT_FIT')
      else fitReason.push('TIME_FITS')

      if (opportunity.requiredLocation && capacity.currentLocation !== opportunity.requiredLocation) {
        frictionReason.push('LOCATION_MISMATCH')
      }

      const missingTools = (opportunity.requiredTools ?? []).filter((tool) => !tools.has(tool))
      if (missingTools.length) frictionReason.push(`MISSING_TOOLS:${missingTools.join(',')}`)
      else if ((opportunity.requiredTools ?? []).length) fitReason.push('TOOLS_AVAILABLE')

      if (opportunity.requiredEnergy && capacity.energy && level[opportunity.requiredEnergy] > level[capacity.energy]) {
        frictionReason.push('ENERGY_MISMATCH')
      } else if (opportunity.requiredEnergy && capacity.energy) {
        fitReason.push('ENERGY_FITS')
      }

      for (const observation of matchingObservations(opportunity, capacity)) {
        if (observation.effect === 'supports') fitReason.push(`OBSERVED_SUPPORT:${observation.evidenceRef}`)
        else frictionReason.push(`OBSERVED_CAUTION:${observation.evidenceRef}`)
      }

      if (opportunity.priority === 'high') fitReason.push('HIGH_PRIORITY')
      if (opportunity.interest === 'high') fitReason.push('HIGH_INTEREST')
      if (opportunity.growthValue === 'high') fitReason.push('HIGH_GROWTH_VALUE')

      const score = (opportunity.priority ? level[opportunity.priority] * 4 : 0)
        + (opportunity.interest ? level[opportunity.interest] * 2 : 0)
        + (opportunity.growthValue ? level[opportunity.growthValue] : 0)
        + fitReason.filter((reason) => reason.startsWith('OBSERVED_SUPPORT:')).length * 2
        - frictionReason.length * 20

      return {
        option: {
          opportunityId: opportunity.id,
          label: labelFor(opportunity),
          fitReason,
          frictionReason,
          confidence: total != null && frictionReason.length === 0 ? 'high' as const : 'medium' as const,
        },
        score,
      }
    })
    .filter(({ option }) => !option.frictionReason.some((reason) =>
      reason === 'TIME_DOES_NOT_FIT'
      || reason === 'LOCATION_MISMATCH'
      || reason === 'ENERGY_MISMATCH'
      || reason.startsWith('MISSING_TOOLS:'),
    ))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ option }) => option)
}
