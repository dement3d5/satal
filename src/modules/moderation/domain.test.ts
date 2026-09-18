import {describe, expect, it} from 'vitest';

import {
  assertAssignedToActor,
  assertAssignmentAvailable,
  assertModerationCapability,
  assertReviewableCase,
  hasModerationCapability,
  moderationCaseAge
} from './domain';

describe('moderation authorization and lifecycle', () => {
  it('grants moderation capabilities only to explicit staff roles', () => {
    expect(hasModerationCapability([], 'queue:read')).toBe(false);
    expect(hasModerationCapability(['moderator'], 'decision:write')).toBe(true);
    expect(hasModerationCapability(['moderator'], 'message-reports:decide')).toBe(true);
    expect(hasModerationCapability(['moderator'], 'review-reports:decide')).toBe(true);
    expect(hasModerationCapability(['moderator'], 'assignment:write')).toBe(true);
    expect(hasModerationCapability(['moderator'], 'assignment:override')).toBe(false);
    expect(hasModerationCapability(['admin'], 'assignment:override')).toBe(true);
    expect(hasModerationCapability(['moderator'], 'listings:self-review')).toBe(false);
    expect(hasModerationCapability(['admin'], 'listings:self-review')).toBe(false);
    expect(hasModerationCapability(['owner'], 'listings:self-review')).toBe(true);
    expect(hasModerationCapability(['moderator'], 'operations:read')).toBe(false);
    expect(hasModerationCapability(['admin'], 'operations:read')).toBe(true);
    expect(hasModerationCapability(['owner'], 'operations:read')).toBe(true);
    expect(() => assertModerationCapability([], 'queue:read')).toThrowError(
      expect.objectContaining({code: 'FORBIDDEN'})
    );
  });

  it('prevents parallel ownership while keeping unassigned and own cases actionable', () => {
    expect(() => assertAssignmentAvailable({actorId: 'a', assignedTo: null})).not.toThrow();
    expect(() => assertAssignmentAvailable({actorId: 'a', assignedTo: 'a'})).not.toThrow();
    expect(() => assertAssignmentAvailable({actorId: 'a', assignedTo: 'b'})).toThrowError(
      expect.objectContaining({code: 'CONFLICT'})
    );
  });

  it('requires the current moderator to claim a case before review decisions', () => {
    expect(() => assertAssignedToActor({actorId: 'a', assignedTo: 'a'})).not.toThrow();
    expect(() => assertAssignedToActor({actorId: 'a', assignedTo: null})).toThrowError(
      expect.objectContaining({code: 'CONFLICT'})
    );
    expect(() => assertAssignedToActor({actorId: 'a', assignedTo: 'b'})).toThrowError(
      expect.objectContaining({code: 'CONFLICT'})
    );
  });

  it('classifies listing queue age against the explicit 18/24 hour thresholds', () => {
    const now = new Date('2026-09-11T12:00:00.000Z');
    expect(moderationCaseAge({openedAt: new Date('2026-09-11T00:01:00.000Z'), now})).toMatchObject({
      ageMinutes: 719,
      slaState: 'within_target'
    });
    expect(moderationCaseAge({openedAt: new Date('2026-09-10T18:00:00.000Z'), now})).toMatchObject({
      ageMinutes: 1080,
      slaState: 'due_soon'
    });
    expect(moderationCaseAge({openedAt: new Date('2026-09-10T12:00:00.000Z'), now})).toMatchObject({
      ageMinutes: 1440,
      slaState: 'overdue'
    });
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
        caseStatus: 'open',
        listingStatus: 'pending_review',
        reviewerId: 'owner',
        sellerId: 'owner',
        allowSelfReview: true
      })
    ).not.toThrow();
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
