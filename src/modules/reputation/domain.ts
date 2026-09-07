import {AppError} from '@/server/errors/app-error';

type ListingStatus = 'pending_review' | 'active' | 'sold' | 'expired' | 'removed' | 'rejected';

export function assertInteractionCanBeQualified(input: {
  actorId: string;
  buyerId: string;
  sellerId: string;
  conversationStatus: 'open' | 'closed';
  listingStatus: ListingStatus;
  buyerHasMessaged: boolean;
  sellerHasMessaged: boolean;
}) {
  assertInteractionConfirmer(input.actorId, input.sellerId);
  if (input.conversationStatus !== 'open')
    throw new AppError('CONFLICT', 'A closed conversation cannot confirm a sale', 409);
  if (input.listingStatus !== 'active')
    throw new AppError('CONFLICT', 'Only an active listing can be marked sold', 409);
  if (!input.buyerHasMessaged || !input.sellerHasMessaged)
    throw new AppError(
      'CONFLICT',
      'Both participants must exchange messages before confirming a sale',
      409
    );
}

export function assertInteractionConfirmer(actorId: string, sellerId: string) {
  if (actorId !== sellerId)
    throw new AppError('FORBIDDEN', 'Only the seller can confirm the sale', 403);
}

export function reviewSubjectId(input: {
  actorId: string;
  buyerId: string;
  sellerId: string;
}): string {
  if (input.actorId === input.buyerId) return input.sellerId;
  if (input.actorId === input.sellerId) return input.buyerId;
  throw new AppError('NOT_FOUND', 'Qualified interaction was not found', 404);
}
