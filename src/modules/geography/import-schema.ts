import {z} from 'zod';

import {locationKinds} from './domain';

const localizedNames = z.object({
  az: z.string().min(1).max(200),
  ru: z.string().min(1).max(200),
  en: z.string().min(1).max(200)
});

export const geographyDatasetSchema = z.object({
  dataset: z.object({
    sourceName: z.string().min(1).max(120),
    verified: z.boolean(),
    version: z.string().min(1).max(80)
  }),
  locations: z.array(
    z.object({
      id: z.uuid(),
      parentId: z.uuid().nullable(),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      kind: z.enum(locationKinds),
      depth: z.number().int().min(0).max(7),
      sortOrder: z.number().int().default(0),
      sourceId: z.string().min(1).max(160),
      names: localizedNames,
      aliases: z
        .array(
          z.object({
            locale: z.enum(['az', 'ru', 'en']),
            value: z.string().min(1).max(200)
          })
        )
        .default([])
    })
  )
});

export type GeographyDataset = z.infer<typeof geographyDatasetSchema>;
