import {describe, expect, it} from 'vitest';

import {
  assertInteractionCanBeQualified,
  assertInteractionConfirmer,
  reviewSubjectId
} from './domain';

const eligible = {
  actorId: 'seller',
  buyerId: 'buyer',
  sellerId: 'seller',
  conversationStatus: 'open' as const,
  listingStatus: 'active' as const,
  buyerHasMessaged: true,
  sellerHasMessaged: true
};

describe('reputation domain', () => {
  it('allows only the seller to qualify a bidirectional open interaction', () => {
    expect(() => assertInteractionConfirmer('seller', 'seller')).not.toThrow();
    expect(() => assertInteractionConfirmer('buyer', 'seller')).toThrowError(
      expect.objectContaining({code: 'FORBIDDEN'})
    );
    expect(() => assertInteractionCanBeQualified(eligible)).not.toThrow();
    expect(() => assertInteractionCanBeQualified({...eligible, actorId: 'buyer'})).toThrowError(
      expect.objectContaining({code: 'FORBIDDEN'})
    );
    expect(() =>
      assertInteractionCanBeQualified({...eligible, conversationStatus: 'closed'})
    ).toThrowError(expect.objectContaining({code: 'CONFLICT'}));
    expect(() =>
      assertInteractionCanBeQualified({...eligible, listingStatus: 'sold'})
    ).toThrowError(expect.objectContaining({code: 'CONFLICT'}));
    expect(() =>
      assertInteractionCanBeQualified({...eligible, sellerHasMessaged: false})
    ).toThrowError(expect.objectContaining({code: 'CONFLICT'}));
  });

  it('derives the review subject and hides interaction existence from outsiders', () => {
    expect(reviewSubjectId({actorId: 'buyer', buyerId: 'buyer', sellerId: 'seller'})).toBe(
      'seller'
    );
    expect(reviewSubjectId({actorId: 'seller', buyerId: 'buyer', sellerId: 'seller'})).toBe(
      'buyer'
    );
    expect(() =>
      reviewSubjectId({actorId: 'outsider', buyerId: 'buyer', sellerId: 'seller'})
    ).toThrowError(expect.objectContaining({code: 'NOT_FOUND'}));
  });
});
