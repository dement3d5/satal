import {AppError} from '@/server/errors/app-error';

export type StaffRole = 'moderator' | 'admin' | 'owner';
export type ModerationCapability =
  | 'queue:read'
  | 'decision:write'
  | 'assignment:write'
  | 'assignment:override'
  | 'reports:read'
  | 'reports:decide'
  | 'appeals:read'
  | 'appeals:decide'
  | 'message-reports:read'
  | 'message-reports:decide'
  | 'review-reports:read'
  | 'review-reports:decide'
  | 'operations:read';

const capabilities: Record<StaffRole, ReadonlySet<ModerationCapability>> = {
  moderator: new Set([
    'queue:read',
    'decision:write',
    'assignment:write',
    'reports:read',
    'reports:decide',
    'appeals:read',
    'appeals:decide',
    'message-reports:read',
    'message-reports:decide',
    'review-reports:read',
    'review-reports:decide'
  ]),
  admin: new Set([
    'queue:read',
    'decision:write',
    'assignment:write',
    'assignment:override',
    'reports:read',
    'reports:decide',
    'appeals:read',
    'appeals:decide',
    'message-reports:read',
    'message-reports:decide',
    'review-reports:read',
    'review-reports:decide',
    'operations:read'
  ]),
  owner: new Set([
    'queue:read',
    'decision:write',
    'assignment:write',
    'assignment:override',
    'reports:read',
    'reports:decide',
    'appeals:read',
    'appeals:decide',
    'message-reports:read',
    'message-reports:decide',
    'review-reports:read',
    'review-reports:decide',
    'operations:read'
  ])
};

export function hasModerationCapability(
  roles: readonly StaffRole[],
  capability: ModerationCapability
): boolean {
  return roles.some((role) => capabilities[role].has(capability));
}

export function assertModerationCapability(
  roles: readonly StaffRole[],
  capability: ModerationCapability
): void {
  if (!hasModerationCapability(roles, capability)) {
    throw new AppError('FORBIDDEN', 'Moderator access is required', 403);
  }
}

export function assertReviewableCase(input: {
  caseStatus: 'open' | 'approved' | 'rejected';
  listingStatus: 'pending_review' | 'active' | 'sold' | 'expired' | 'removed' | 'rejected';
  reviewerId: string;
  sellerId: string;
}): void {
  if (input.reviewerId === input.sellerId) {
    throw new AppError('FORBIDDEN', 'A moderator cannot review their own listing', 403);
  }
  if (input.caseStatus !== 'open' || input.listingStatus !== 'pending_review') {
    throw new AppError('CONFLICT', 'This moderation case is already resolved', 409);
  }
}

export const MODERATION_LISTING_SLA_HOURS = 24;
export const MODERATION_LISTING_DUE_SOON_HOURS = 18;

export type ModerationSlaState = 'within_target' | 'due_soon' | 'overdue';

export function moderationCaseAge(input: {openedAt: Date; now?: Date}): {
  ageMinutes: number;
  slaState: ModerationSlaState;
} {
  const now = input.now ?? new Date();
  const ageMinutes = Math.max(0, Math.floor((now.getTime() - input.openedAt.getTime()) / 60_000));
  const ageHours = ageMinutes / 60;
  const slaState =
    ageHours >= MODERATION_LISTING_SLA_HOURS
      ? 'overdue'
      : ageHours >= MODERATION_LISTING_DUE_SOON_HOURS
        ? 'due_soon'
        : 'within_target';
  return {ageMinutes, slaState};
}

export function assertAssignmentAvailable(input: {
  actorId: string;
  assignedTo: string | null;
}): void {
  if (input.assignedTo && input.assignedTo !== input.actorId) {
    throw new AppError('CONFLICT', 'This moderation case is assigned to another moderator', 409);
  }
}
