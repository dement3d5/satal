import {describe, expect, it} from 'vitest';

import {
  assertCategoryChangeAllowed,
  assertDraftOwner,
  assertDraftTransition,
  assertDraftVersion,
  planCategoryChange,
  recalculateAttributesForCategory,
  statusAfterCategoryChange
} from './draft-domain';

describe('listing draft permissions and lifecycle', () => {
  it('allows only the owner to mutate a draft', () => {
    expect(() => assertDraftOwner('owner', 'owner')).not.toThrow();
    expect(() => assertDraftOwner('intruder', 'owner')).toThrow(/owner/i);
  });

  it('allows only explicit lifecycle transitions', () => {
    expect(() => assertDraftTransition('draft', 'ready_for_review')).not.toThrow();
    expect(() => assertDraftTransition('ready_for_review', 'submitted')).not.toThrow();
    expect(() => assertDraftTransition('submitted', 'draft')).toThrow(/cannot transition/i);
  });

  it('changes category only before submission and returns ready drafts to draft state', () => {
    expect(statusAfterCategoryChange('ready_for_review')).toBe('draft');
    expect(() => assertCategoryChangeAllowed('submitted')).toThrow(/category/i);
  });

  it('rejects a stale autosave version', () => {
    expect(() => assertDraftVersion(3, 3)).not.toThrow();
    expect(() => assertDraftVersion(2, 3)).toThrow(/newer autosave/i);
  });

  it('retains only values that remain applicable and valid for the new category', () => {
    const result = recalculateAttributesForCategory(
      [
        {attributeId: 'shared-condition', value: {type: 'single_select', optionId: 'used'}},
        {attributeId: 'vehicle-mileage', value: {type: 'measurement', value: 100, unit: 'km'}},
        {attributeId: 'shared-year', value: {type: 'integer', value: 1800}}
      ],
      new Map([
        [
          'shared-condition',
          {
            id: 'shared-condition',
            valueType: 'single_select' as const,
            allowedOptionIds: new Set(['used'])
          }
        ],
        [
          'shared-year',
          {id: 'shared-year', valueType: 'integer' as const, minNumeric: 1900, maxNumeric: 2100}
        ]
      ])
    );

    expect(result.retained.map((item) => item.attributeId)).toEqual(['shared-condition']);
    expect(result.removedAttributeIds).toEqual(['vehicle-mileage', 'shared-year']);
  });

  it('plans an owner-authorized category change with an optimistic version increment', () => {
    const plan = planCategoryChange({
      actorId: 'owner',
      ownerId: 'owner',
      status: 'ready_for_review',
      expectedVersion: 7,
      persistedVersion: 7,
      currentValues: [],
      nextRules: new Map()
    });

    expect(plan).toMatchObject({nextStatus: 'draft', nextVersion: 8});
  });
});
