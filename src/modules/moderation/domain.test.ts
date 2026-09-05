import {describe, expect, it} from 'vitest';

import {assertModerationCapability, assertReviewableCase, hasModerationCapability} from './domain';

describe('moderation authorization and lifecycle', () => {
  it('grants moderation capabilities only to explicit staff roles', () => {
    expect(hasModerationCapability([], 'queue:read')).toBe(false);
    expect(hasModerationCapability(['moderator'], 'decision:write')).toBe(true);
    expect(() => assertModerationCapability([], 'queue:read')).toThrowError(
      expect.objectContaining({code: 'FORBIDDEN'})
    );
  });

  it('blocks self-review and already resolved cases', () => {
    expect(() =>
      assertReviewableCase({
        caseStatus: 'open',
        listingStatus: 'pending_review',
        reviewerId: 'same',
        sellerId: 'same'
      })
    ).toThrowError(expect.objectContaining({code: 'FORBIDDEN'}));
    expect(() =>
      assertReviewableCase({
        caseStatus: 'approved',
        listingStatus: 'active',
        reviewerId: 'reviewer',
        sellerId: 'seller'
      })
    ).toThrowError(expect.objectContaining({code: 'CONFLICT'}));
  });
});
