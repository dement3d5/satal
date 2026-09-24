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

export const createDraftSchema = z.object({
  categoryId: uuid,
  shopId: uuid.nullable().optional()
});

export const autosaveDraftSchema = z
  .object({
    version: z.int().positive(),
    title: z.string().max(180).optional(),
    description: z.string().max(20_000).optional(),
    priceMinor: z.int().safe().nonnegative().nullable().optional(),
    locationId: uuid.nullable().optional(),
    publicLocationPrecision: z.enum(['city', 'district', 'neighborhood']).optional(),
    mapLatitude: z.number().finite().min(-90).max(90).nullable().optional(),
    mapLongitude: z.number().finite().min(-180).max(180).nullable().optional(),
    publicLocationLabel: z.string().trim().min(2).max(200).nullable().optional(),
    attributes: z.array(draftAttributeValueSchema).max(100).optional()
  })
  .superRefine((value, context) => {
    if (
      (value.mapLatitude === null &&
        value.mapLongitude !== null &&
        value.mapLongitude !== undefined) ||
      (value.mapLongitude === null && value.mapLatitude !== null && value.mapLatitude !== undefined)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['mapLatitude'],
        message: 'Map latitude and longitude must be cleared together'
      });
    }
    if (
      (typeof value.mapLatitude === 'number' && typeof value.mapLongitude !== 'number') ||
      (typeof value.mapLongitude === 'number' && typeof value.mapLatitude !== 'number')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['mapLongitude'],
        message: 'Map latitude and longitude must be provided together'
      });
    }
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.priceMinor !== undefined ||
      value.locationId !== undefined ||
      value.publicLocationPrecision !== undefined ||
      value.mapLatitude !== undefined ||
      value.mapLongitude !== undefined ||
      value.publicLocationLabel !== undefined ||
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
