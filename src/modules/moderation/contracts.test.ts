import {describe, expect, it} from 'vitest';

import {
  moderationDecisionSchema,
  moderationQueueQuerySchema,
  ownerListingQuerySchema
} from './contracts';

describe('moderation contracts', () => {
  it('defaults bounded queue input and approve reason', () => {
    expect(moderationQueueQuerySchema.parse({})).toEqual({locale: 'az', limit: 30});
    expect(ownerListingQuerySchema.parse({locale: 'ru', limit: '12'})).toEqual({
      locale: 'ru',
      limit: 12
    });
    expect(moderationDecisionSchema.parse({action: 'approve'})).toEqual({
      action: 'approve',
      reasonCode: 'policy_compliant'
    });
  });

  it('requires a safe seller-facing explanation for rejection', () => {
    expect(() =>
      moderationDecisionSchema.parse({
        action: 'reject',
        reasonCode: 'wrong_category',
        publicExplanation: 'short'
      })
    ).toThrow();
    expect(
      moderationDecisionSchema.parse({
        action: 'reject',
        reasonCode: 'wrong_category',
        publicExplanation: 'Please choose the correct category.'
      })
    ).toMatchObject({action: 'reject', reasonCode: 'wrong_category'});
  });
});
