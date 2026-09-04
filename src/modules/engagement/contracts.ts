import {z} from 'zod';

export const localeSchema = z.enum(['az', 'ru', 'en']);

export const favoriteListQuerySchema = z.object({
  locale: localeSchema.default('az')
});

export const savedSearchListQuerySchema = z.object({
  locale: localeSchema.optional()
});

export const createSavedSearchSchema = z.object({
  name: z.string().trim().min(1).max(100),
  locale: localeSchema,
  query: z.string().max(4000)
});

export const renameSavedSearchSchema = z.object({
  name: z.string().trim().min(1).max(100)
});
