import {z} from 'zod';

import {attributeValueTypes} from '@/modules/catalog/domain';

const uuid = z.uuid();

export const draftAttributeValueSchema = z.discriminatedUnion('type', [
  z.object({attributeId: uuid, type: z.literal('text'), value: z.string()}),
  z.object({attributeId: uuid, type: z.literal('integer'), value: z.int().safe()}),
  z.object({attributeId: uuid, type: z.literal('decimal'), value: z.number().finite()}),
  z.object({attributeId: uuid, type: z.literal('boolean'), value: z.boolean()}),
  z.object({attributeId: uuid, type: z.literal('single_select'), optionId: uuid}),
  z.object({attributeId: uuid, type: z.literal('multi_select'), optionIds: z.array(uuid)}),
  z.object({attributeId: uuid, type: z.literal('date'), value: z.iso.date()}),
  z.object({
    attributeId: uuid,
    type: z.literal('measurement'),
    value: z.number().finite(),
    unit: z.string()
  })
]);

export const createDraftSchema = z.object({categoryId: uuid});

export const autosaveDraftSchema = z
  .object({
    version: z.int().positive(),
    title: z.string().max(180).optional(),
    description: z.string().max(20_000).optional(),
    priceMinor: z.int().safe().nonnegative().nullable().optional(),
    locationId: uuid.nullable().optional(),
    publicLocationPrecision: z.enum(['city', 'district', 'neighborhood']).optional(),
    attributes: z.array(draftAttributeValueSchema).max(100).optional()
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.priceMinor !== undefined ||
      value.locationId !== undefined ||
      value.publicLocationPrecision !== undefined ||
      value.attributes !== undefined,
    {message: 'Autosave must contain at least one change'}
  );

export const changeDraftCategorySchema = z.object({
  version: z.int().positive(),
  categoryId: uuid
});

export type DraftAttributeInput = z.infer<typeof draftAttributeValueSchema>;
export type AutosaveDraftInput = z.infer<typeof autosaveDraftSchema>;

export const supportedDraftAttributeTypes = attributeValueTypes;
