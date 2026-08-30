import {z} from 'zod';

export const publishListingSchema = z.object({
  version: z.int().positive()
});

export const publicListingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(48).default(24),
  cursor: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  locationId: z.uuid().optional()
});

export type PublishListingInput = z.infer<typeof publishListingSchema>;
export type PublicListingQuery = z.infer<typeof publicListingQuerySchema>;
