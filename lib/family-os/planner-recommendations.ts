import { rankNextBestBlockOptions } from './next-best-block.ts'
import type { NextBestBlockOption, Opportunity } from './contracts.ts'
import { schedulePlannerWishes, type FamilyPlannerModel, type PlannedTimebox, type PlannerWish } from './family-planner.ts'

export type PlannerRecommendation = Omit<NextBestBlockOption, 'opportunityId'> & {
  wishId: string
  title: string
  owner: string
}

/** Adapts planner wishes to the existing Next Best Block contract without adding a second scorer. */
export function recommendPlannerWishes(
  wishes: PlannerWish[],
  model: FamilyPlannerModel,
  existing: PlannedTimebox[] = [],
): PlannerRecommendation[] {
  if (!model.known || !model.days.length) return []
  const availableMinutes = Math.max(...model.days.flatMap((day) => day.gaps.map((gap) => gap.minutes)), 0)
  if (availableMinutes <= 0) return []

  const opportunities: Opportunity[] = wishes.map((wish) => ({
    id: wish.id,
    ownerId: wish.owner,
    title: wish.title,
    mode: 'together',
    estimatedMinutes: wish.minutes,
    priority: wish.required ? 'high' : 'medium',
    evidenceRefs: [],
  }))
  const ranked = rankNextBestBlockOptions(opportunities, {
    personId: wishes[0]?.owner ?? 'family',
    availableMinutes,
    evidenceRefs: [],
  })
  const wishById = new Map(wishes.map((wish) => [wish.id, wish]))
  return ranked.flatMap((option) => {
    const wish = wishById.get(option.opportunityId)
    if (!wish || schedulePlannerWishes([wish], model, existing).plans.length !== 1) return []
    return [{
      label: option.label,
      fitReason: option.fitReason,
      frictionReason: option.frictionReason,
      confidence: option.confidence,
      wishId: wish.id,
      title: wish.title,
      owner: wish.owner,
    }]
  })
}
