import {AppError} from '@/server/errors/app-error';

export function assertReportableReview(input: {
  actorId: string;
  authorId: string;
  reviewStatus: 'active' | 'hidden';
  publiclyVisible: boolean;
}): void {
  if (input.actorId === input.authorId) {
    throw new AppError('FORBIDDEN', 'You cannot report your own review', 403);
  }
  if (input.reviewStatus !== 'active' || !input.publiclyVisible) {
    throw new AppError('NOT_FOUND', 'Review was not found', 404);
  }
}

export function assertOpenReviewReport(input: {
  reportStatus: 'open' | 'dismissed' | 'resolved';
  reviewStatus: 'active' | 'hidden';
  reviewerId: string;
  reporterId: string;
  authorId: string;
  subjectId: string;
  reviewerReportedReview: boolean;
}): void {
  if (
    input.reviewerId === input.reporterId ||
    input.reviewerId === input.authorId ||
    input.reviewerId === input.subjectId ||
    input.reviewerReportedReview
  ) {
    throw new AppError(
      'FORBIDDEN',
      'A moderator cannot review a report connected to their account',
      403
    );
  }
  if (input.reportStatus !== 'open' || input.reviewStatus !== 'active') {
    throw new AppError('CONFLICT', 'This review report is no longer actionable', 409);
  }
}
