import {describe, expect, it} from 'vitest';

import {createSavedSearchSchema, favoriteListQuerySchema} from './contracts';

describe('engagement contracts', () => {
  it('accepts supported locales and trims saved search names', () => {
    expect(
      createSavedSearchSchema.parse({name: '  Family cars  ', locale: 'az', query: 'q=Toyota'})
    ).toEqual({name: 'Family cars', locale: 'az', query: 'q=Toyota'});
    expect(favoriteListQuerySchema.parse({})).toEqual({locale: 'az'});
  });

  it('rejects unsupported locales and oversized query snapshots', () => {
    expect(() => createSavedSearchSchema.parse({name: 'Cars', locale: 'de', query: ''})).toThrow();
    expect(() =>
      createSavedSearchSchema.parse({name: 'Cars', locale: 'az', query: 'x'.repeat(4001)})
    ).toThrow();
  });
});
