import {describe, expect, it} from 'vitest';

import {evaluateListingRisk, LISTING_RISK_POLICY_VERSION} from './risk-policy';

const now = new Date('2026-09-11T00:00:00.000Z');

describe('listing risk policy', () => {
  it('classifies an established account without content signals as low risk', () => {
    expect(
      evaluateListingRisk({
        sellerCreatedAt: new Date('2026-08-01T00:00:00.000Z'),
        title: 'Wooden dining table',
        description: 'A well maintained dining table available for collection in Baku.',
        now
      })
    ).toEqual({policyVersion: LISTING_RISK_POLICY_VERSION, score: 0, riskBand: 'low', signals: []});
  });

  it('returns only bounded reason codes and weights, never matched private content', () => {
    const result = evaluateListingRisk({
      sellerCreatedAt: new Date('2026-09-10T00:00:00.000Z'),
      title: 'Recently listed apartment',
      description: 'Write to seller@example.test or call +994 50 123 45 67 for more details.',
      now
    });

    expect(result).toEqual({
      policyVersion: LISTING_RISK_POLICY_VERSION,
      score: 75,
      riskBand: 'high',
      signals: [
        {code: 'new_account', weight: 30},
        {code: 'contact_details_in_content', weight: 45}
      ]
    });
    expect(JSON.stringify(result)).not.toContain('seller@example.test');
    expect(JSON.stringify(result)).not.toContain('+994');
  });

  it('treats the exact account-age boundary as established', () => {
    expect(
      evaluateListingRisk({
        sellerCreatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        title: 'Boundary listing',
        description: 'A complete listing description without any direct contact details.',
        now
      }).riskBand
    ).toBe('low');
  });
});
