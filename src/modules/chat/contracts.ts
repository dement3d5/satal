import {z} from 'zod';

export const chatLocaleSchema = z.enum(['az', 'ru', 'en']);

export const conversationListQuerySchema = z.object({
  locale: chatLocaleSchema.default('az'),
  limit: z.coerce.number().int().min(1).max(50).default(30)
});

export const messageListQuerySchema = z.object({
  beforeSequence: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

const messageFields = {
  clientMessageId: z.uuid(),
  body: z.string().trim().min(1).max(2000)
};

export const startConversationSchema = z.object({
  listingId: z.uuid(),
  ...messageFields
});

export const sendMessageSchema = z.object(messageFields);

export type ConversationListQuery = z.infer<typeof conversationListQuerySchema>;
export type MessageListQuery = z.infer<typeof messageListQuerySchema>;
export type StartConversationInput = z.infer<typeof startConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
