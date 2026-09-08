import {describe, expect, it} from 'vitest';

import {assertOpenReviewReport, assertReportableReview} from './review-report-domain';

describe('review report policy', () => {
  it('allows reports only against a different author and a public active review', () => {
    expect(() =>
      assertReportableReview({
        actorId: 'author',
        authorId: 'author',
        reviewStatus: 'active',
        publiclyVisible: true
      })
    ).toThrowError(expect.objectContaining({code: 'FORBIDDEN'}));
    expect(() =>
      assertReportableReview({
        actorId: 'reader',
        authorId: 'author',
        reviewStatus: 'active',
        publiclyVisible: false
      })
    ).toThrowError(expect.objectContaining({code: 'NOT_FOUND'}));
  });

  it('requires an independent moderator and an actionable report', () => {
    expect(() =>
      assertOpenReviewReport({
        reportStatus: 'open',
        reviewStatus: 'active',
        reviewerId: 'subject',
        reporterId: 'reporter',
        authorId: 'author',
        subjectId: 'subject',
        reviewerReportedReview: false
      })
    ).toThrowError(expect.objectContaining({code: 'FORBIDDEN'}));
    expect(() =>
      assertOpenReviewReport({
        reportStatus: 'resolved',
        reviewStatus: 'hidden',
        reviewerId: 'moderator',
        reporterId: 'reporter',
        authorId: 'author',
        subjectId: 'subject',
        reviewerReportedReview: false
      })
    ).toThrowError(expect.objectContaining({code: 'CONFLICT'}));

    expect(() =>
      assertOpenReviewReport({
        reportStatus: 'open',
        reviewStatus: 'active',
        reviewerId: 'moderator',
        reporterId: 'another-reporter',
        authorId: 'author',
        subjectId: 'subject',
        reviewerReportedReview: true
      })
    ).toThrowError(expect.objectContaining({code: 'FORBIDDEN'}));
  });
});
