import {AppError} from '@/server/errors/app-error';

type ListingStatus = 'pending_review' | 'active' | 'sold' | 'expired' | 'removed' | 'rejected';

export function assertReportableListing(input: {
  actorId: string;
  sellerId: string;
  listingStatus: ListingStatus;
}): void {
  if (input.listingStatus !== 'active')
    throw new AppError('NOT_FOUND', 'Listing was not found', 404);
  if (input.actorId === input.sellerId)
    throw new AppError('FORBIDDEN', 'You cannot report your own listing', 403);
}

export function assertOpenReport(input: {
  reportStatus: 'open' | 'dismissed' | 'resolved';
  listingStatus: ListingStatus;
  reviewerId: string;
  sellerId: string;
}): void {
  if (input.reviewerId === input.sellerId)
    throw new AppError('FORBIDDEN', 'A moderator cannot review reports on their own listing', 403);
  if (input.reportStatus !== 'open' || input.listingStatus !== 'active')
    throw new AppError('CONFLICT', 'This report is no longer actionable', 409);
}

export function assertAppealableListing(input: {
  actorId: string;
  sellerId: string;
  listingStatus: ListingStatus;
  caseStatus: 'open' | 'approved' | 'rejected';
  moderationAction: 'approve' | 'reject' | null;
}): void {
  if (input.actorId !== input.sellerId)
    throw new AppError('NOT_FOUND', 'Listing review was not found', 404);
  if (
    input.listingStatus !== 'rejected' ||
    input.caseStatus !== 'rejected' ||
    input.moderationAction !== 'reject'
  )
    throw new AppError('CONFLICT', 'This listing cannot be appealed', 409);
}

export function assertOpenAppeal(input: {
  appealStatus: 'open' | 'accepted' | 'rejected';
  listingStatus: ListingStatus;
  caseStatus: 'open' | 'approved' | 'rejected';
  reviewerId: string;
  sellerId: string;
}): void {
  if (input.reviewerId === input.sellerId)
    throw new AppError('FORBIDDEN', 'A moderator cannot review their own appeal', 403);
  if (
    input.appealStatus !== 'open' ||
    input.listingStatus !== 'rejected' ||
    input.caseStatus !== 'rejected'
  )
    throw new AppError('CONFLICT', 'This appeal is no longer actionable', 409);
}
