import {describe, expect, it} from 'vitest';

import {
  assertConversationCanSend,
  assertConversationCanStart,
  assertConversationParticipant,
  otherParticipantId
} from './domain';

describe('chat domain rules', () => {
  it('allows an authenticated non-seller to start on an active listing', () => {
    expect(() =>
      assertConversationCanStart({
        buyerId: 'buyer',
        sellerId: 'seller',
        listingStatus: 'active',
        blocked: false
      })
    ).not.toThrow();
  });

  it('rejects self-messaging, inactive listings and blocks', () => {
    expect(() =>
      assertConversationCanStart({
        buyerId: 'seller',
        sellerId: 'seller',
        listingStatus: 'active',
        blocked: false
      })
    ).toThrowError(expect.objectContaining({code: 'FORBIDDEN'}));
    expect(() =>
      assertConversationCanStart({
        buyerId: 'buyer',
        sellerId: 'seller',
        listingStatus: 'removed',
        blocked: false
      })
    ).toThrowError(expect.objectContaining({code: 'NOT_FOUND'}));
    expect(() =>
      assertConversationCanStart({
        buyerId: 'buyer',
        sellerId: 'seller',
        listingStatus: 'active',
        blocked: true
      })
    ).toThrowError(expect.objectContaining({code: 'FORBIDDEN'}));
  });

  it('keeps reads private to participants and permits follow-up on sold listings', () => {
    expect(
      assertConversationCanSend({
        actorId: 'seller',
        buyerId: 'buyer',
        sellerId: 'seller',
        conversationStatus: 'open',
        listingStatus: 'sold',
        blocked: false
      })
    ).toBe('seller');
    expect(() =>
      assertConversationParticipant({actorId: 'intruder', buyerId: 'buyer', sellerId: 'seller'})
    ).toThrowError(expect.objectContaining({code: 'NOT_FOUND'}));
    expect(otherParticipantId({actorId: 'buyer', buyerId: 'buyer', sellerId: 'seller'})).toBe(
      'seller'
    );
  });
});
