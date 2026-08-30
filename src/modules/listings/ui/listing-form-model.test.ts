import {describe, expect, it} from 'vitest';

import {collectAttributeValues, findCategoryPath, hasAttributeValue} from './listing-form-model';

describe('listing creation form model', () => {
  it('finds a nested category without hardcoded category knowledge', () => {
    const leaf = {id: 'leaf', slug: 'leaf', name: 'Leaf', depth: 2, schemaVersion: 1, children: []};
    const tree = [
      {id: 'root', slug: 'root', name: 'Root', depth: 0, schemaVersion: 1, children: [leaf]}
    ];
    expect(findCategoryPath(tree, 'leaf').map((item) => item.id)).toEqual(['root', 'leaf']);
  });

  it('collects only populated transport values', () => {
    expect(
      collectAttributeValues({
        first: {attributeId: 'first', type: 'integer', value: 2026},
        second: undefined
      })
    ).toHaveLength(1);
  });

  it('distinguishes empty selectable and textual values', () => {
    expect(hasAttributeValue({attributeId: 'x', type: 'text', value: '  '})).toBe(false);
    expect(hasAttributeValue({attributeId: 'x', type: 'multi_select', optionIds: []})).toBe(false);
    expect(hasAttributeValue({attributeId: 'x', type: 'boolean', value: false})).toBe(true);
  });
});
