export function canSuspendAccount(actorId: string, targetId: string, targetIsAdmin: boolean): boolean {
  return actorId !== targetId && !targetIsAdmin;
}