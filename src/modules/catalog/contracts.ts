import {z} from 'zod';

import {routing} from '@/i18n/routing';

export const localeSchema = z.enum(routing.locales);
export type ContractLocale = z.infer<typeof localeSchema>;

export interface CategoryNodeContract {
  id: string;
  slug: string;
  name: string;
  depth: number;
  schemaVersion: number;
  children: CategoryNodeContract[];
}

export interface AttributeOptionContract {
  id: string;
  key: string;
  label: string;
}

export interface CategoryAttributeContract {
  id: string;
  key: string;
  label: string;
  helpText: string | null;
  valueType:
    | 'text'
    | 'integer'
    | 'decimal'
    | 'boolean'
    | 'single_select'
    | 'multi_select'
    | 'date'
    | 'measurement';
  unit: string | null;
  required: boolean;
  filterable: boolean;
  searchable: boolean;
  sortable: boolean;
  order: number;
  constraints: {
    minNumeric: number | null;
    maxNumeric: number | null;
    minLength: number | null;
    maxLength: number | null;
    pattern: string | null;
    minSelections: number | null;
    maxSelections: number | null;
  };
  options: AttributeOptionContract[];
}

export interface CategorySchemaContract {
  category: {id: string; slug: string; name: string; schemaVersion: number};
  attributes: CategoryAttributeContract[];
}
