import {describe, expect, it} from 'vitest';

import type {LocationContract} from '@/modules/geography/contracts';

import {isPublicLocation, precisionFor} from './listing-creation';

function location(kind: LocationContract['kind']): LocationContract {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    parentId: null,
    slug: kind,
    name: kind,
    kind,
    depth: 1,
    verified: false
  };
}

describe('listing creation location selection', () => {
  it('persists a Baku metro as a public neighborhood-level location', () => {
    const metro = location('metro');
    expect(isPublicLocation(metro)).toBe(true);
    expect(precisionFor(metro)).toBe('neighborhood');
  });

  it('does not persist a street as the public location', () => {
    expect(isPublicLocation(location('street'))).toBe(false);
  });
});
