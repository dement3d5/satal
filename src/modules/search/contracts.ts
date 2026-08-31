import {z} from 'zod';

import {AppError} from '@/server/errors/app-error';

const uuid = z.uuid();
const baseSearchSchema = z.object({
  q: z.string().trim().max(120).default(''),
  categoryId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  priceMin: z.coerce.number().finite().min(0).max(1_000_000_000).optional(),
  priceMax: z.coerce.number().finite().min(0).max(1_000_000_000).optional(),
  sort: z.enum(['relevance', 'newest', 'price_asc', 'price_desc']).default('relevance'),
  page: z.coerce.number().int().min(1).max(100).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24)
});

export interface OptionSearchFilter {
  type: 'options';
  attributeId: string;
  optionIds: string[];
}

export interface NumericSearchFilter {
  type: 'numeric';
  attributeId: string;
  min?: number;
  max?: number;
}

export interface BooleanSearchFilter {
  type: 'boolean';
  attributeId: string;
  value: boolean;
}

export type DynamicSearchFilter = OptionSearchFilter | NumericSearchFilter | BooleanSearchFilter;

export interface SearchQuery {
  q: string;
  categoryId?: string;
  locationId?: string;
  priceMinMinor?: number;
  priceMaxMinor?: number;
  sort: 'relevance' | 'newest' | 'price_asc' | 'price_desc';
  page: number;
  limit: number;
  filters: DynamicSearchFilter[];
}

export function parseSearchParams(params: URLSearchParams): SearchQuery {
  const parsed = baseSearchSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) {
    throw new AppError(
      'BAD_REQUEST',
      parsed.error.issues[0]?.message ?? 'Invalid search query',
      400
    );
  }
  const priceMinMinor = toMinor(parsed.data.priceMin);
  const priceMaxMinor = toMinor(parsed.data.priceMax);
  if (priceMinMinor !== undefined && priceMaxMinor !== undefined && priceMinMinor > priceMaxMinor) {
    throw new AppError('BAD_REQUEST', 'Minimum price cannot exceed maximum price', 400);
  }

  const options = new Map<string, Set<string>>();
  const numeric = new Map<string, {min?: number; max?: number}>();
  const booleans = new Map<string, boolean>();
  for (const [key, value] of params.entries()) {
    const [prefix, rawAttributeId, bound] = key.split('.');
    const attributeId = uuid.safeParse(rawAttributeId);
    if (!attributeId.success) continue;
    if (prefix === 'f') {
      const optionId = uuid.safeParse(value);
      if (!optionId.success) throw new AppError('BAD_REQUEST', 'Invalid attribute option', 400);
      const selected = options.get(attributeId.data) ?? new Set<string>();
      selected.add(optionId.data);
      options.set(attributeId.data, selected);
    } else if (prefix === 'n' && (bound === 'min' || bound === 'max')) {
      const number = Number(value);
      if (!Number.isFinite(number))
        throw new AppError('BAD_REQUEST', 'Invalid numeric filter', 400);
      const selected = numeric.get(attributeId.data) ?? {};
      selected[bound] = number;
      numeric.set(attributeId.data, selected);
    } else if (prefix === 'b' && (value === 'true' || value === 'false')) {
      booleans.set(attributeId.data, value === 'true');
    }
  }
  const filters: DynamicSearchFilter[] = [
    ...[...options].map(([attributeId, values]) => ({
      type: 'options' as const,
      attributeId,
      optionIds: [...values]
    })),
    ...[...numeric].map(([attributeId, value]) => ({
      type: 'numeric' as const,
      attributeId,
      ...value
    })),
    ...[...booleans].map(([attributeId, value]) => ({
      type: 'boolean' as const,
      attributeId,
      value
    }))
  ];
  if (filters.length > 20) throw new AppError('BAD_REQUEST', 'Too many attribute filters', 400);

  return {
    q: normalizeSearchText(parsed.data.q),
    ...(parsed.data.categoryId ? {categoryId: parsed.data.categoryId} : {}),
    ...(parsed.data.locationId ? {locationId: parsed.data.locationId} : {}),
    ...(priceMinMinor !== undefined ? {priceMinMinor} : {}),
    ...(priceMaxMinor !== undefined ? {priceMaxMinor} : {}),
    sort: parsed.data.q
      ? parsed.data.sort
      : parsed.data.sort === 'relevance'
        ? 'newest'
        : parsed.data.sort,
    page: parsed.data.page,
    limit: parsed.data.limit,
    filters
  };
}

export function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function toMinor(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const minor = Math.round(value * 100);
  if (!Number.isSafeInteger(minor)) throw new AppError('BAD_REQUEST', 'Price is too large', 400);
  return minor;
}
