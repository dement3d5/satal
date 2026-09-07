import {z} from 'zod';

export const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  unreadOnly: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default(false)
});

export const updateNotificationSchema = z.object({read: z.literal(true)});

export const updateNotificationPreferencesSchema = z
  .object({
    inAppEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional()
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one preference is required'
  });

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;
