export const BOOKING_TRANSITIONS: Record<string, readonly string[]> = {
  new: ['in_review', 'rejected', 'cancelled'],
  in_review: ['pending_payment', 'rejected', 'cancelled'],
  pending_payment: ['pending_onboarding', 'cancelled'],
  pending_onboarding: ['completed', 'cancelled'],
  completed: [],
  rejected: [],
  cancelled: [],
};

export const MAINTENANCE_TRANSITIONS: Record<string, readonly string[]> = {
  submitted: ['assigned', 'rejected', 'cancelled'],
  assigned: ['in_progress', 'rejected', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function canTransition(
  map: Record<string, readonly string[]>,
  from: string | null | undefined,
  to: string,
): boolean {
  if (!from) return false;
  if (from === to) return true;
  return map[from]?.includes(to) ?? false;
}
