import {AppError} from '@/server/errors/app-error';

export type StaffRole = 'moderator' | 'admin' | 'owner';
export type ModerationCapability = 'queue:read' | 'decision:write';

const capabilities: Record<StaffRole, ReadonlySet<ModerationCapability>> = {
  moderator: new Set(['queue:read', 'decision:write']),
  admin: new Set(['queue:read', 'decision:write']),
  owner: new Set(['queue:read', 'decision:write'])
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
