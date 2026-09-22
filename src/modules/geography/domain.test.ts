import {describe, expect, it} from 'vitest';

import bakuMetroJson from '../../../data/geography/baku-metro.official.az.json' with {type: 'json'};
import geographyJson from '../../../data/geography/dev.az.json' with {type: 'json'};
import {assertLocationPlacement} from './domain';
import {geographyDatasetSchema} from './import-schema';

describe('geography import contract', () => {
  it('accepts the minimal AZ/RU/EN dev dataset and labels it unverified', () => {
    const dataset = geographyDatasetSchema.parse(geographyJson);

    expect(dataset.dataset.verified).toBe(false);
    expect(dataset.locations.every((item) => item.names.az && item.names.ru && item.names.en)).toBe(
      true
    );
  });

  it('accepts the verified Baku metro import with all current unique station names', () => {
    const dataset = geographyDatasetSchema.parse(bakuMetroJson);

    expect(dataset.dataset.verified).toBe(true);
    expect(dataset.locations).toHaveLength(26);
    expect(new Set(dataset.locations.map((location) => location.names.az)).size).toBe(26);
    expect(dataset.locations.every((location) => location.kind === 'metro')).toBe(true);
  });

  it('validates parent kinds and depth', () => {
    expect(() => assertLocationPlacement({kind: 'country', depth: 0})).not.toThrow();
    expect(() =>
      assertLocationPlacement({kind: 'city', depth: 1, parent: {kind: 'country', depth: 0}})
    ).not.toThrow();
    expect(() =>
      assertLocationPlacement({kind: 'street', depth: 1, parent: {kind: 'country', depth: 0}})
    ).toThrow(/parent/i);
    expect(() =>
      assertLocationPlacement({kind: 'neighborhood', depth: 4, parent: {kind: 'city', depth: 1}})
    ).toThrow(/parent/i);
  });
});
