export function resolveSpecificActorIdentity(
  actorId: string,
  allowedSpecificActorIds: readonly string[],
): string | null {
  return allowedSpecificActorIds.includes(actorId) ? actorId : null
}
