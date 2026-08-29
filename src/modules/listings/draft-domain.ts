import type {AttributeRules, AttributeValue} from '@/modules/catalog/domain';
import {validateAttributeValue} from '@/modules/catalog/domain';
import {AppError} from '@/server/errors/app-error';

export type DraftStatus = 'draft' | 'ready_for_review' | 'submitted' | 'abandoned';

const allowedTransitions: Record<DraftStatus, ReadonlySet<DraftStatus>> = {
  draft: new Set(['ready_for_review', 'abandoned']),
  ready_for_review: new Set(['draft', 'submitted', 'abandoned']),
  submitted: new Set(),
  abandoned: new Set(['draft'])
};

export function assertDraftOwner(actorId: string, ownerId: string): void {
  if (actorId !== ownerId) {
    throw new AppError('FORBIDDEN', 'Only the draft owner may modify this draft', 403);
  }
}

export function assertDraftTransition(from: DraftStatus, to: DraftStatus): void {
  if (!allowedTransitions[from].has(to)) {
    throw new AppError('CONFLICT', `Draft cannot transition from ${from} to ${to}`, 409);
  }
}

export function assertCategoryChangeAllowed(status: DraftStatus): void {
  if (status !== 'draft' && status !== 'ready_for_review') {
    throw new AppError('CONFLICT', 'Category cannot change in the current draft state', 409);
  }
}

export function assertDraftVersion(expectedVersion: number, persistedVersion: number): void {
  if (expectedVersion !== persistedVersion) {
    throw new AppError('CONFLICT', 'Draft was changed by a newer autosave', 409);
  }
}

export interface StoredDraftAttribute {
  attributeId: string;
  value: AttributeValue;
}

export function recalculateAttributesForCategory(
  currentValues: readonly StoredDraftAttribute[],
  nextRules: ReadonlyMap<string, AttributeRules>
): {retained: StoredDraftAttribute[]; removedAttributeIds: string[]} {
  const retained: StoredDraftAttribute[] = [];
  const removedAttributeIds: string[] = [];

  for (const stored of currentValues) {
    const rules = nextRules.get(stored.attributeId);
    if (!rules) {
      removedAttributeIds.push(stored.attributeId);
      continue;
    }
    try {
      validateAttributeValue(rules, stored.value);
      retained.push(stored);
    } catch {
      removedAttributeIds.push(stored.attributeId);
    }
  }

  return {retained, removedAttributeIds};
}

export function statusAfterCategoryChange(status: DraftStatus): 'draft' {
  assertCategoryChangeAllowed(status);
  return 'draft';
}

export function planCategoryChange(input: {
  actorId: string;
  ownerId: string;
  status: DraftStatus;
  expectedVersion: number;
  persistedVersion: number;
  currentValues: readonly StoredDraftAttribute[];
  nextRules: ReadonlyMap<string, AttributeRules>;
}): {
  nextStatus: 'draft';
  nextVersion: number;
  retained: StoredDraftAttribute[];
  removedAttributeIds: string[];
} {
  assertDraftOwner(input.actorId, input.ownerId);
  assertDraftVersion(input.expectedVersion, input.persistedVersion);
  const nextStatus = statusAfterCategoryChange(input.status);
  const recalculated = recalculateAttributesForCategory(input.currentValues, input.nextRules);

  return {
    nextStatus,
    nextVersion: input.persistedVersion + 1,
    ...recalculated
  };
}
