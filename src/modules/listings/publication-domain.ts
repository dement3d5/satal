import type {AttributeRules, AttributeValue} from '@/modules/catalog/domain';
import {validateAttributeValue} from '@/modules/catalog/domain';
import {AppError} from '@/server/errors/app-error';

import type {DraftStatus} from './draft-domain';

export type PublicationAttributeRules = AttributeRules & {required: boolean};

export interface PublicationAttribute {
  attributeId: string;
  value: AttributeValue;
}

export interface PublicationDraftSnapshot {
  status: DraftStatus;
  title: string;
  description: string;
  priceMinor: number | null;
  currency: string;
  locationId: string | null;
  attributes: readonly PublicationAttribute[];
}

export function assertPublishableDraft(
  draft: PublicationDraftSnapshot,
  rules: ReadonlyMap<string, PublicationAttributeRules>
): void {
  if (draft.status !== 'draft' && draft.status !== 'ready_for_review') {
    throw new AppError('CONFLICT', 'Draft cannot be published in its current state', 409);
  }

  const title = draft.title.trim();
  const description = draft.description.trim();
  if (title.length < 5 || title.length > 180) {
    throw new AppError('BAD_REQUEST', 'Listing title must contain 5 to 180 characters', 400);
  }
  if (description.length < 20 || description.length > 20_000) {
    throw new AppError(
      'BAD_REQUEST',
      'Listing description must contain 20 to 20000 characters',
      400
    );
  }
  if (!draft.locationId) {
    throw new AppError('BAD_REQUEST', 'Listing location is required', 400);
  }
  if (draft.priceMinor !== null && (!Number.isSafeInteger(draft.priceMinor) || draft.priceMinor < 0)) {
    throw new AppError('BAD_REQUEST', 'Listing price must be a non-negative safe integer', 400);
  }
  if (draft.currency !== 'AZN') {
    throw new AppError('BAD_REQUEST', 'Only AZN listings are supported in the MVP', 400);
  }

  const values = new Map<string, AttributeValue>();
  for (const attribute of draft.attributes) {
    if (values.has(attribute.attributeId)) {
      throw new AppError('BAD_REQUEST', 'Each listing attribute may appear only once', 400);
    }
    const rule = rules.get(attribute.attributeId);
    if (!rule) {
      throw new AppError('BAD_REQUEST', 'Listing contains an inapplicable attribute', 400);
    }
    validateAttributeValue(rule, attribute.value);
    values.set(attribute.attributeId, attribute.value);
  }

  const missingRequired = [...rules.values()]
    .filter((rule) => rule.required && !values.has(rule.id))
    .map((rule) => rule.id);
  if (missingRequired.length) {
    throw new AppError(
      'BAD_REQUEST',
      `Required listing attributes are missing: ${missingRequired.join(', ')}`,
      400
    );
  }
}

export function publicLocationDepth(precision: 'city' | 'district' | 'neighborhood'): number {
  if (precision === 'city') return 2;
  if (precision === 'district') return 3;
  return 4;
}
