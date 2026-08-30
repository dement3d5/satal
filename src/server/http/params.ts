import {z} from 'zod';

import {localeSchema, type ContractLocale} from '@/modules/catalog/contracts';
import {AppError} from '@/server/errors/app-error';

const uuidSchema = z.uuid();

export function parseUuid(value: string, label: string): string {
  const result = uuidSchema.safeParse(value);
  if (!result.success) throw new AppError('BAD_REQUEST', `${label} must be a UUID`, 400);
  return result.data;
}

export function parseLocale(value: string | null): ContractLocale {
  const result = localeSchema.safeParse(value ?? 'az');
  if (!result.success) throw new AppError('BAD_REQUEST', 'locale must be az, ru or en', 400);
  return result.data;
}
