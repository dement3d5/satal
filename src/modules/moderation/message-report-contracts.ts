import {z} from 'zod';

export const messageReportReasonSchema = z.enum([
  'spam',
  'fraud',
  'harassment',
  'prohibited_content',
  'personal_data',
  'other'
]);

export const createMessageReportSchema = z
  .object({
    reason: messageReportReasonSchema,
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

export const messageReportDecisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('dismiss'),
    internalNote: z.string().trim().max(2000).optional()
  }),
  z.object({
    action: z.literal('close_conversation'),
    internalNote: z.string().trim().max(2000).optional()
  })
]);

export type CreateMessageReportInput = z.infer<typeof createMessageReportSchema>;
export type MessageReportDecisionInput = z.infer<typeof messageReportDecisionSchema>;
