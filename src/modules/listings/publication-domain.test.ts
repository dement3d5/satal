import {describe, expect, it} from 'vitest';

import {
  assertPublishableDraft,
  publicLocationDepth,
  selectPublicLocationId
} from './publication-domain';

const rules = new Map([
  [
    'condition',
    {
      id: 'condition',
      valueType: 'single_select' as const,
      required: true,
      allowedOptionIds: new Set(['used'])
    }
  ],
  ['year', {id: 'year', valueType: 'integer' as const, required: false, minNumeric: 1900}]
]);

const validDraft = {
  status: 'draft' as const,
  title: 'Clean test listing',
  description: 'A complete description suitable for publication.',
  priceMinor: 250_000,
  currency: 'AZN',
  locationId: 'location',
  attributes: [
    {attributeId: 'condition', value: {type: 'single_select' as const, optionId: 'used'}}
  ]
};

describe('listing publication rules', () => {
  it('accepts a complete draft and supported private-location precision', () => {
    expect(() => assertPublishableDraft(validDraft, rules)).not.toThrow();
    expect(publicLocationDepth('city')).toBeLessThan(publicLocationDepth('neighborhood'));
  });

  it('requires title, description, location and every required category attribute', () => {
    expect(() => assertPublishableDraft({...validDraft, title: 'x'}, rules)).toThrow(/title/i);
    expect(() => assertPublishableDraft({...validDraft, description: 'short'}, rules)).toThrow(
      /description/i
    );
    expect(() => assertPublishableDraft({...validDraft, locationId: null}, rules)).toThrow(
      /location/i
    );
    expect(() => assertPublishableDraft({...validDraft, attributes: []}, rules)).toThrow(
      /required/i
    );
  });

  it('rejects stale or inapplicable values and a submitted draft', () => {
    expect(() =>
      assertPublishableDraft(
        {...validDraft, attributes: [{attributeId: 'unknown', value: {type: 'text', value: 'x'}}]},
        rules
      )
    ).toThrow(/inapplicable/i);
    expect(() => assertPublishableDraft({...validDraft, status: 'submitted'}, rules)).toThrow(
      /current state/i
    );
  });

  it('coarsens a private selected location to the requested public precision', () => {
    const ancestry = [
      {id: 'street', kind: 'street' as const},
      {id: 'district', kind: 'district' as const},
      {id: 'city', kind: 'city' as const},
      {id: 'country', kind: 'country' as const}
    ];
    expect(selectPublicLocationId(ancestry, 'district')).toBe('district');
    expect(selectPublicLocationId(ancestry, 'city')).toBe('city');
  });
});
