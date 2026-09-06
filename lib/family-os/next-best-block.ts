import type { CapacitySnapshot, NextBestBlockOption, Opportunity } from './contracts.ts'

const level = { low: 1, medium: 2, high: 3 } as const

function labelFor(opportunity: Opportunity): NextBestBlockOption['label'] {
  if ((opportunity.estimatedMinutes ?? Infinity) <= 20 && opportunity.priority !== 'low') return 'quick_win'
  if (opportunity.priority === 'high') return 'important'
  if (opportunity.growthValue === 'high') return 'growth'
  return 'other'
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
      if (opportunity.estimatedMinutes == null) frictionReason.push('DURATION_UNKNOWN')
      else if (opportunity.estimatedMinutes > capacity.availableMinutes) frictionReason.push('TIME_DOES_NOT_FIT')
      else fitReason.push('TIME_FITS')
      if (opportunity.requiredLocation && capacity.currentLocation !== opportunity.requiredLocation) frictionReason.push('LOCATION_MISMATCH')
      const missingTools = (opportunity.requiredTools ?? []).filter((tool) => !tools.has(tool))
      if (missingTools.length) frictionReason.push(`MISSING_TOOLS:${missingTools.join(',')}`)
      else if ((opportunity.requiredTools ?? []).length) fitReason.push('TOOLS_AVAILABLE')
      if (opportunity.priority === 'high') fitReason.push('HIGH_PRIORITY')
      if (opportunity.interest === 'high') fitReason.push('HIGH_INTEREST')
      if (opportunity.growthValue === 'high') fitReason.push('HIGH_GROWTH_VALUE')
      const score = (opportunity.priority ? level[opportunity.priority] * 4 : 0)
        + (opportunity.interest ? level[opportunity.interest] * 2 : 0)
        + (opportunity.growthValue ? level[opportunity.growthValue] : 0)
        - frictionReason.length * 20
      return {
        option: {
          opportunityId: opportunity.id,
          label: labelFor(opportunity),
          fitReason,
          frictionReason,
          confidence: opportunity.estimatedMinutes != null && frictionReason.length === 0 ? 'high' as const : 'medium' as const,
        },
        score,
      }
    })
    .filter(({ option }) => !option.frictionReason.some((reason) => reason === 'TIME_DOES_NOT_FIT' || reason === 'LOCATION_MISMATCH' || reason.startsWith('MISSING_TOOLS:')))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ option }) => option)
}
