import {describe, expect, it} from 'vitest';

import {
  assertAppealableListing,
  assertOpenAppeal,
  assertOpenReport,
  assertReportableListing
} from './trust-domain';

describe('trust and safety lifecycle rules', () => {
  it('allows only authenticated non-sellers to report active listings', () => {
    expect(() =>
      assertReportableListing({actorId: 'buyer', sellerId: 'seller', listingStatus: 'active'})
    ).not.toThrow();
    expect(() =>
      assertReportableListing({actorId: 'seller', sellerId: 'seller', listingStatus: 'active'})
    ).toThrowError(expect.objectContaining({code: 'FORBIDDEN'}));
    expect(() =>
      assertReportableListing({actorId: 'buyer', sellerId: 'seller', listingStatus: 'removed'})
    ).toThrowError(expect.objectContaining({code: 'NOT_FOUND'}));
  });

  it('requires current ownership and a concrete rejection for appeals', () => {
    expect(() =>
      assertAppealableListing({
        actorId: 'seller',
        sellerId: 'seller',
        listingStatus: 'rejected',
        caseStatus: 'rejected',
        moderationAction: 'reject'
      })
    ).not.toThrow();
    expect(() =>
      assertAppealableListing({
        actorId: 'other',
        sellerId: 'seller',
        listingStatus: 'rejected',
        caseStatus: 'rejected',
        moderationAction: 'reject'
      })
    ).toThrowError(expect.objectContaining({code: 'NOT_FOUND'}));
  });

  it('blocks self-review and stale report or appeal decisions', () => {
    expect(() =>
      assertOpenReport({
        reportStatus: 'open',
        listingStatus: 'active',
        reviewerId: 'seller',
        sellerId: 'seller'
      })
    ).toThrowError(expect.objectContaining({code: 'FORBIDDEN'}));
    expect(() =>
      assertOpenAppeal({
        appealStatus: 'accepted',
        listingStatus: 'pending_review',
        caseStatus: 'open',
        reviewerId: 'reviewer',
        sellerId: 'seller'
      })
    ).toThrowError(expect.objectContaining({code: 'CONFLICT'}));
  });
});
