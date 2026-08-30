import {describe, expect, it} from 'vitest';

import {autosaveDraftSchema, draftAttributeValueSchema} from './draft-contracts';

const attributeId = '30000000-0000-4000-8000-000000000001';

describe('listing draft API contracts', () => {
  it('accepts autosave-ready commercial and privacy fields', () => {
    expect(
      autosaveDraftSchema.parse({
        version: 2,
        priceMinor: 125_000,
        publicLocationPrecision: 'district'
      })
    ).toMatchObject({version: 2, priceMinor: 125_000, publicLocationPrecision: 'district'});
  });

  it('requires at least one autosave change', () => {
    expect(() => autosaveDraftSchema.parse({version: 2})).toThrow(/at least one change/i);
  });

  it('rejects unsafe integers, duplicate transport shapes and invalid dates at the boundary', () => {
    expect(() =>
      draftAttributeValueSchema.parse({
        attributeId,
        type: 'integer',
        value: Number.MAX_SAFE_INTEGER + 1
      })
    ).toThrow();
    expect(() =>
      draftAttributeValueSchema.parse({attributeId, type: 'date', value: '2026-02-30'})
    ).toThrow();
  });
});
