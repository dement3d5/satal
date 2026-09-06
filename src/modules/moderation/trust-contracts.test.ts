import {describe, expect, it} from 'vitest';

import {
  createListingAppealSchema,
  createListingReportSchema,
  listingAppealDecisionSchema,
  listingReportDecisionSchema,
  trustQueueQuerySchema
} from './trust-contracts';

describe('trust and safety contracts', () => {
  it('accepts bounded report reasons and requires details for other', () => {
    expect(createListingReportSchema.parse({reason: 'fraud'})).toEqual({reason: 'fraud'});
    expect(() => createListingReportSchema.parse({reason: 'other'})).toThrow();
    expect(
      createListingReportSchema.parse({
        reason: 'other',
        details: 'The listing has another clear policy issue.'
      })
    ).toMatchObject({reason: 'other'});
  });

  it('bounds queues, appeals and staff decisions', () => {
    expect(trustQueueQuerySchema.parse({locale: 'ru', limit: '12'})).toEqual({
      locale: 'ru',
      limit: 12
    });
    expect(() => createListingAppealSchema.parse({statement: 'Too short'})).toThrow();
    expect(() => listingAppealDecisionSchema.parse({action: 'reject'})).toThrow();
    expect(
      listingAppealDecisionSchema.parse({
        action: 'reject',
        publicResponse: 'The original policy decision still applies.'
      })
    ).toMatchObject({action: 'reject'});
    expect(listingReportDecisionSchema.parse({action: 'remove_listing'})).toEqual({
      action: 'remove_listing'
    });
  });
});
