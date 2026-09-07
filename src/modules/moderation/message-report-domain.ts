import {AppError} from '@/server/errors/app-error';

export function assertMessageReportAccess(input: {
  actorId: string;
  buyerId: string;
  sellerId: string;
  senderId: string;
}): void {
  if (input.actorId !== input.buyerId && input.actorId !== input.sellerId) {
    throw new AppError('NOT_FOUND', 'Message was not found', 404);
  }
  if (input.actorId === input.senderId) {
    throw new AppError('FORBIDDEN', 'You cannot report your own message', 403);
  }
}

export function assertReportableMessage(
  input: Parameters<typeof assertMessageReportAccess>[0] & {
    conversationStatus: 'open' | 'closed';
  }
): void {
  assertMessageReportAccess(input);
  if (input.conversationStatus !== 'open') {
    throw new AppError('CONFLICT', 'This conversation no longer accepts reports', 409);
  }
}

export function assertOpenMessageReport(input: {
  reportStatus: 'open' | 'dismissed' | 'resolved';
  conversationStatus: 'open' | 'closed';
  reviewerId: string;
  reporterId: string;
  buyerId: string;
  sellerId: string;
}): void {
  if (
    input.reviewerId === input.reporterId ||
    input.reviewerId === input.buyerId ||
    input.reviewerId === input.sellerId
  ) {
    throw new AppError(
      'FORBIDDEN',
      'A moderator cannot review a conversation they participated in',
      403
    );
  }
  if (input.reportStatus !== 'open' || input.conversationStatus !== 'open') {
    throw new AppError('CONFLICT', 'This message report is no longer actionable', 409);
  }
}
