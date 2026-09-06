import {z} from 'zod';

export const listingReportReasonSchema = z.enum([
  'fraud',
  'wrong_category',
  'prohibited_item',
  'duplicate',
  'misleading_price',
  'stale_listing',
  'other'
]);

export const createListingReportSchema = z
  .object({
    reason: listingReportReasonSchema,
    details: z.string().trim().min(10).max(1000).optional()
  })
  .superRefine((value, context) => {
    if (value.reason === 'other' && (!value.details || value.details.length < 20)) {
      context.addIssue({
        code: 'custom',
        path: ['details'],
        message: 'Please provide at least 20 characters for another reason'
      });
    }
  });

export const trustQueueQuerySchema = z.object({
  locale: z.enum(['az', 'ru', 'en']).default('az'),
  limit: z.coerce.number().int().min(1).max(50).default(30)
});

export const listingReportDecisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('dismiss'),
    internalNote: z.string().trim().max(2000).optional()
  }),
  z.object({
    action: z.literal('remove_listing'),
    internalNote: z.string().trim().max(2000).optional()
  })
]);

export const createListingAppealSchema = z.object({
  statement: z.string().trim().min(20).max(1000)
});

export const listingAppealDecisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('accept'),
    publicResponse: z.string().trim().min(10).max(500).optional(),
    internalNote: z.string().trim().max(2000).optional()
  }),
  z.object({
    action: z.literal('reject'),
    publicResponse: z.string().trim().min(10).max(500),
    internalNote: z.string().trim().max(2000).optional()
  })
]);

export type CreateListingReportInput = z.infer<typeof createListingReportSchema>;
export type ListingReportDecisionInput = z.infer<typeof listingReportDecisionSchema>;
export type CreateListingAppealInput = z.infer<typeof createListingAppealSchema>;
export type ListingAppealDecisionInput = z.infer<typeof listingAppealDecisionSchema>;
export type TrustQueueQuery = z.infer<typeof trustQueueQuerySchema>;
