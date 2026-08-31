import {describe, expect, it} from 'vitest';

import {AppError} from '@/server/errors/app-error';

import {normalizeSearchText, parseSearchParams} from './contracts';

const attributeId = '11111111-1111-4111-8111-111111111111';
const optionId = '22222222-2222-4222-8222-222222222222';

describe('search contracts', () => {
  it('normalizes query, converts prices and reads dynamic filters', () => {
    const params = new URLSearchParams({
      q: '  Toyota   Camry  ',
      priceMin: '12.50',
      [`f.${attributeId}`]: optionId,
      [`b.${attributeId}`]: 'true',
      [`n.${attributeId}.max`]: '2024'
    });
    expect(parseSearchParams(params)).toMatchObject({
      q: 'Toyota Camry',
      priceMinMinor: 1250,
      sort: 'relevance',
      filters: [
        {type: 'options', attributeId, optionIds: [optionId]},
        {type: 'numeric', attributeId, max: 2024},
        {type: 'boolean', attributeId, value: true}
      ]
    });
  });

  it('uses newest order for an empty relevance query', () => {
    expect(parseSearchParams(new URLSearchParams()).sort).toBe('newest');
  });

  it('rejects inverted prices', () => {
    expect(() => parseSearchParams(new URLSearchParams({priceMin: '20', priceMax: '10'}))).toThrow(
      AppError
    );
  });

  it('normalizes unicode compatibility characters', () => {
    expect(normalizeSearchText('  ＩＰＨＯＮＥ\t15 ')).toBe('IPHONE 15');
  });
});
