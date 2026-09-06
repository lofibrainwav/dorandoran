export function resolveCalendarMutation(input: {
  isProtected: boolean
  actor: 'chad_auto' | 'human'
  operation: 'move' | 'delete' | 'edit'
}): { allowed: boolean; gateRequired: boolean; reason: string } {
  if (!input.isProtected) return { allowed: true, gateRequired: false, reason: 'UNPROTECTED_BLOCK' }
  if (input.actor === 'human') return { allowed: false, gateRequired: true, reason: 'PROTECTED_BLOCK_HUMAN_GATE' }
  return { allowed: false, gateRequired: false, reason: 'PROTECTED_BLOCK_AUTO_MUTATION_DENIED' }
}
