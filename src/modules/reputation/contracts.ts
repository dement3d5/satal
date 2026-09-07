import {z} from 'zod';

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(10).max(1000).optional()
});

export const publicReputationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type PublicReputationQuery = z.infer<typeof publicReputationQuerySchema>;
