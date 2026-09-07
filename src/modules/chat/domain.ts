import {AppError} from '@/server/errors/app-error';

type ListingStatus = 'pending_review' | 'active' | 'sold' | 'expired' | 'removed' | 'rejected';

export function assertConversationCanStart(input: {
  buyerId: string;
  sellerId: string;
  listingStatus: ListingStatus;
  blocked: boolean;
}): void {
  if (input.listingStatus !== 'active')
    throw new AppError('NOT_FOUND', 'Listing was not found', 404);
  if (input.buyerId === input.sellerId)
    throw new AppError('FORBIDDEN', 'You cannot message yourself', 403);
  if (input.blocked) throw new AppError('FORBIDDEN', 'Messaging is unavailable', 403);
}

export function assertConversationParticipant(input: {
  actorId: string;
  buyerId: string;
  sellerId: string;
}): 'buyer' | 'seller' {
  if (input.actorId === input.buyerId) return 'buyer';
  if (input.actorId === input.sellerId) return 'seller';
  throw new AppError('NOT_FOUND', 'Conversation was not found', 404);
}

export function assertConversationCanSend(input: {
  actorId: string;
  buyerId: string;
  sellerId: string;
  conversationStatus: 'open' | 'closed';
  listingStatus: ListingStatus;
  blocked: boolean;
}): 'buyer' | 'seller' {
  const role = assertConversationParticipant(input);
  if (input.conversationStatus !== 'open')
    throw new AppError('CONFLICT', 'Conversation is closed', 409);
  if (input.listingStatus !== 'active' && input.listingStatus !== 'sold')
    throw new AppError('CONFLICT', 'This listing no longer accepts messages', 409);
  if (input.blocked) throw new AppError('FORBIDDEN', 'Messaging is unavailable', 403);
  return role;
}

export function otherParticipantId(input: {
  actorId: string;
  buyerId: string;
  sellerId: string;
}): string {
  return assertConversationParticipant(input) === 'buyer' ? input.sellerId : input.buyerId;
}
