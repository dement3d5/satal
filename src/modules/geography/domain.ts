import {AppError} from '@/server/errors/app-error';

export const locationKinds = [
  'country',
  'economic_region',
  'city',
  'district',
  'settlement',
  'neighborhood',
  'metro',
  'street'
] as const;

export type LocationKind = (typeof locationKinds)[number];

const allowedChildren: Record<LocationKind, ReadonlySet<LocationKind>> = {
  country: new Set(['economic_region', 'city', 'district']),
  economic_region: new Set(['city', 'district', 'settlement']),
  city: new Set(['district', 'settlement', 'neighborhood', 'metro', 'street']),
  district: new Set(['settlement', 'neighborhood', 'metro', 'street']),
  settlement: new Set(['neighborhood', 'street']),
  neighborhood: new Set(['street']),
  metro: new Set(),
  street: new Set()
};

export function assertLocationPlacement(input: {
  kind: LocationKind;
  depth: number;
  parent?: {kind: LocationKind; depth: number} | null;
}): void {
  const {kind, depth, parent = null} = input;

  if (depth < 0 || depth > 7) {
    throw new AppError('BAD_REQUEST', 'Location depth is outside the supported range', 400);
  }
  if (!parent) {
    if (kind !== 'country' || depth !== 0) {
      throw new AppError('BAD_REQUEST', 'Only a country can be a root location', 400);
    }
    return;
  }
  if (depth !== parent.depth + 1 || !allowedChildren[parent.kind].has(kind)) {
    throw new AppError('BAD_REQUEST', 'Location is not valid beneath its parent', 400);
  }
}
