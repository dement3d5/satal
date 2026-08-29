import {AppError} from '@/server/errors/app-error';

export const attributeValueTypes = [
  'text',
  'integer',
  'decimal',
  'boolean',
  'single_select',
  'multi_select',
  'date',
  'measurement'
] as const;

export type AttributeValueType = (typeof attributeValueTypes)[number];

export interface AttributeRules {
  id: string;
  valueType: AttributeValueType;
  unit?: string | null;
  minNumeric?: number | null;
  maxNumeric?: number | null;
  minLength?: number | null;
  maxLength?: number | null;
  validationPattern?: string | null;
  minSelections?: number | null;
  maxSelections?: number | null;
  allowedOptionIds?: ReadonlySet<string>;
}

export type AttributeValue =
  | {type: 'text'; value: string}
  | {type: 'integer'; value: number}
  | {type: 'decimal'; value: number}
  | {type: 'boolean'; value: boolean}
  | {type: 'single_select'; optionId: string}
  | {type: 'multi_select'; optionIds: readonly string[]}
  | {type: 'date'; value: string}
  | {type: 'measurement'; value: number; unit: string};

export function assertCategoryPlacement(parentDepth: number | null, depth: number): void {
  if (depth < 0 || depth > 2) {
    throw new AppError('BAD_REQUEST', 'Category depth must be between 0 and 2', 400);
  }

  if (
    (parentDepth === null && depth !== 0) ||
    (parentDepth !== null && depth !== parentDepth + 1)
  ) {
    throw new AppError('BAD_REQUEST', 'Category depth must follow its parent', 400);
  }
}

export function validateAttributeValue(rules: AttributeRules, value: AttributeValue): void {
  if (rules.valueType !== value.type) {
    throw new AppError('BAD_REQUEST', `Expected ${rules.valueType} attribute value`, 400);
  }

  if (value.type === 'text') {
    if (
      rules.minLength !== null &&
      rules.minLength !== undefined &&
      value.value.length < rules.minLength
    ) {
      throw new AppError('BAD_REQUEST', 'Attribute text is shorter than allowed', 400);
    }
    if (
      rules.maxLength !== null &&
      rules.maxLength !== undefined &&
      value.value.length > rules.maxLength
    ) {
      throw new AppError('BAD_REQUEST', 'Attribute text is longer than allowed', 400);
    }
    if (rules.validationPattern && !new RegExp(rules.validationPattern, 'u').test(value.value)) {
      throw new AppError('BAD_REQUEST', 'Attribute text does not match its required format', 400);
    }
    return;
  }

  if (value.type === 'integer') {
    if (!Number.isSafeInteger(value.value)) {
      throw new AppError('BAD_REQUEST', 'Integer attribute must be a safe integer', 400);
    }
    assertNumericRange(rules, value.value);
    return;
  }

  if (value.type === 'decimal') {
    assertFiniteNumber(value.value);
    assertNumericRange(rules, value.value);
    return;
  }

  if (value.type === 'measurement') {
    assertFiniteNumber(value.value);
    assertNumericRange(rules, value.value);
    if (!rules.unit || value.unit !== rules.unit) {
      throw new AppError(
        'BAD_REQUEST',
        'Measurement unit does not match the attribute schema',
        400
      );
    }
    return;
  }

  if (value.type === 'single_select') {
    assertAllowedOption(rules, value.optionId);
    return;
  }

  if (value.type === 'multi_select') {
    const uniqueOptions = new Set(value.optionIds);
    if (uniqueOptions.size !== value.optionIds.length) {
      throw new AppError('BAD_REQUEST', 'Multi-select options must be unique', 400);
    }
    if (
      rules.minSelections !== null &&
      rules.minSelections !== undefined &&
      uniqueOptions.size < rules.minSelections
    ) {
      throw new AppError('BAD_REQUEST', 'Too few options selected', 400);
    }
    if (
      rules.maxSelections !== null &&
      rules.maxSelections !== undefined &&
      uniqueOptions.size > rules.maxSelections
    ) {
      throw new AppError('BAD_REQUEST', 'Too many options selected', 400);
    }
    for (const optionId of uniqueOptions) assertAllowedOption(rules, optionId);
    return;
  }

  if (value.type === 'date' && !isIsoCalendarDate(value.value)) {
    throw new AppError('BAD_REQUEST', 'Date attribute must use a valid YYYY-MM-DD value', 400);
  }
}

function assertFiniteNumber(value: number): void {
  if (!Number.isFinite(value)) {
    throw new AppError('BAD_REQUEST', 'Numeric attribute must be finite', 400);
  }
}

function assertNumericRange(rules: AttributeRules, value: number): void {
  if (rules.minNumeric !== null && rules.minNumeric !== undefined && value < rules.minNumeric) {
    throw new AppError('BAD_REQUEST', 'Attribute value is below its minimum', 400);
  }
  if (rules.maxNumeric !== null && rules.maxNumeric !== undefined && value > rules.maxNumeric) {
    throw new AppError('BAD_REQUEST', 'Attribute value is above its maximum', 400);
  }
}

function assertAllowedOption(rules: AttributeRules, optionId: string): void {
  if (!rules.allowedOptionIds?.has(optionId)) {
    throw new AppError('BAD_REQUEST', 'Option does not belong to the attribute schema', 400);
  }
}

function isIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}
