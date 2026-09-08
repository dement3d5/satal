import {z} from 'zod';

export const reviewReportReasonSchema = z.enum([
  'spam',
  'harassment',
  'personal_data',
  'irrelevant',
  'prohibited_content',
  'other'
]);

export const createReviewReportSchema = z
  .object({
    reason: reviewReportReasonSchema,
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

export const reviewReportDecisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('dismiss'),
    internalNote: z.string().trim().max(2000).optional()
  }),
  z.object({
    action: z.literal('hide_review'),
    internalNote: z.string().trim().max(2000).optional()
  })
]);

export type CreateReviewReportInput = z.infer<typeof createReviewReportSchema>;
export type ReviewReportDecisionInput = z.infer<typeof reviewReportDecisionSchema>;
