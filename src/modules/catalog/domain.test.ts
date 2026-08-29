import {describe, expect, it} from 'vitest';

import {assertCategoryPlacement, validateAttributeValue} from './domain';

describe('category schema', () => {
  it('accepts a root, child, and leaf but rejects a fourth level', () => {
    expect(() => assertCategoryPlacement(null, 0)).not.toThrow();
    expect(() => assertCategoryPlacement(0, 1)).not.toThrow();
    expect(() => assertCategoryPlacement(1, 2)).not.toThrow();
    expect(() => assertCategoryPlacement(2, 3)).toThrow(/depth/i);
  });

  it('requires depth to follow the parent', () => {
    expect(() => assertCategoryPlacement(0, 2)).toThrow(/parent/i);
  });
});

describe('dynamic attribute validation', () => {
  it('supports text, integer, decimal, boolean, date, selects, and measurements', () => {
    expect(() =>
      validateAttributeValue(
        {id: 'model', valueType: 'text', minLength: 1, maxLength: 20},
        {type: 'text', value: 'Corolla'}
      )
    ).not.toThrow();
    expect(() =>
      validateAttributeValue(
        {id: 'year', valueType: 'integer', minNumeric: 1900, maxNumeric: 2100},
        {type: 'integer', value: 2024}
      )
    ).not.toThrow();
    expect(() =>
      validateAttributeValue(
        {id: 'engine', valueType: 'decimal', minNumeric: 0.1, maxNumeric: 20},
        {type: 'decimal', value: 2.5}
      )
    ).not.toThrow();
    expect(() =>
      validateAttributeValue(
        {id: 'furnished', valueType: 'boolean'},
        {type: 'boolean', value: true}
      )
    ).not.toThrow();
    expect(() =>
      validateAttributeValue({id: 'date', valueType: 'date'}, {type: 'date', value: '2028-02-29'})
    ).not.toThrow();
    expect(() =>
      validateAttributeValue(
        {id: 'condition', valueType: 'single_select', allowedOptionIds: new Set(['used'])},
        {type: 'single_select', optionId: 'used'}
      )
    ).not.toThrow();
    expect(() =>
      validateAttributeValue(
        {
          id: 'features',
          valueType: 'multi_select',
          minSelections: 1,
          maxSelections: 2,
          allowedOptionIds: new Set(['ac', 'parking'])
        },
        {type: 'multi_select', optionIds: ['ac', 'parking']}
      )
    ).not.toThrow();
    expect(() =>
      validateAttributeValue(
        {id: 'mileage', valueType: 'measurement', unit: 'km', minNumeric: 0},
        {type: 'measurement', value: 45000, unit: 'km'}
      )
    ).not.toThrow();
  });

  it('rejects invalid ranges, options, dates, duplicates, and units', () => {
    expect(() =>
      validateAttributeValue(
        {id: 'year', valueType: 'integer', minNumeric: 1900},
        {type: 'integer', value: 1800}
      )
    ).toThrow(/minimum/i);
    expect(() =>
      validateAttributeValue(
        {id: 'condition', valueType: 'single_select', allowedOptionIds: new Set(['new'])},
        {type: 'single_select', optionId: 'used'}
      )
    ).toThrow(/option/i);
    expect(() =>
      validateAttributeValue({id: 'date', valueType: 'date'}, {type: 'date', value: '2027-02-29'})
    ).toThrow(/date/i);
    expect(() =>
      validateAttributeValue(
        {id: 'features', valueType: 'multi_select', allowedOptionIds: new Set(['ac'])},
        {type: 'multi_select', optionIds: ['ac', 'ac']}
      )
    ).toThrow(/unique/i);
    expect(() =>
      validateAttributeValue(
        {id: 'area', valueType: 'measurement', unit: 'm2'},
        {type: 'measurement', value: 80, unit: 'ft2'}
      )
    ).toThrow(/unit/i);
  });
});
