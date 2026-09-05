import {z} from 'zod';

export const moderationQueueQuerySchema = z.object({
  locale: z.enum(['az', 'ru', 'en']).default('az'),
  limit: z.coerce.number().int().min(1).max(50).default(30)
});

export const ownerListingQuerySchema = z.object({
  locale: z.enum(['az', 'ru', 'en']).default('az'),
  limit: z.coerce.number().int().min(1).max(50).default(30)
});

const rejectionReasonSchema = z.enum([
  'prohibited_item',
  'fraud_risk',
  'duplicate',
  'wrong_category',
  'insufficient_information',
  'policy_other'
]);

export const moderationDecisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    reasonCode: z.literal('policy_compliant').default('policy_compliant'),
    internalNote: z.string().trim().max(2000).optional()
  }),
  z.object({
    action: z.literal('reject'),
    reasonCode: rejectionReasonSchema,
    publicExplanation: z.string().trim().min(10).max(500),
    internalNote: z.string().trim().max(2000).optional()
  })
]);

export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;
export type ModerationQueueQuery = z.infer<typeof moderationQueueQuerySchema>;
