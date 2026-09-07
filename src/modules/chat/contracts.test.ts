import {randomUUID} from 'node:crypto';

import {describe, expect, it} from 'vitest';

import {
  conversationListQuerySchema,
  messageListQuerySchema,
  sendMessageSchema,
  startConversationSchema
} from './contracts';

describe('chat contracts', () => {
  it('bounds pagination and trims message text', () => {
    expect(conversationListQuerySchema.parse({locale: 'ru'})).toEqual({locale: 'ru', limit: 30});
    expect(messageListQuerySchema.safeParse({limit: 101}).success).toBe(false);
    expect(sendMessageSchema.parse({clientMessageId: randomUUID(), body: '  hello  '}).body).toBe(
      'hello'
    );
  });

  it('requires UUID identities and a non-empty bounded body', () => {
    expect(
      startConversationSchema.safeParse({listingId: 'bad', clientMessageId: 'bad', body: ''})
        .success
    ).toBe(false);
    expect(
      sendMessageSchema.safeParse({clientMessageId: randomUUID(), body: 'x'.repeat(2001)}).success
    ).toBe(false);
  });
});
