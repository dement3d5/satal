import type {CategoryNodeContract} from '@/modules/catalog/contracts';
import type {DraftAttributeInput} from '@/modules/listings/draft-contracts';

export type AttributeState = Record<string, DraftAttributeInput | undefined>;

export function collectAttributeValues(state: AttributeState): DraftAttributeInput[] {
  return Object.values(state).filter((value): value is DraftAttributeInput => value !== undefined);
}

export function findCategoryPath(
  categories: readonly CategoryNodeContract[],
  categoryId: string
): CategoryNodeContract[] {
  for (const category of categories) {
    if (category.id === categoryId) return [category];
    const nested = findCategoryPath(category.children, categoryId);
    if (nested.length) return [category, ...nested];
  }
  return [];
}

export function hasAttributeValue(value: DraftAttributeInput | undefined): boolean {
  if (!value) return false;
  if (value.type === 'multi_select') return value.optionIds.length > 0;
  if (value.type === 'single_select') return value.optionId.length > 0;
  if (value.type === 'text' || value.type === 'date') return value.value.trim().length > 0;
  return true;
}
