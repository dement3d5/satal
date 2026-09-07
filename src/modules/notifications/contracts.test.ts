import {describe, expect, it} from 'vitest';

import {
  notificationListQuerySchema,
  updateNotificationPreferencesSchema,
  updateNotificationSchema
} from './contracts';

describe('notification contracts', () => {
  it('bounds list queries and parses unread-only explicitly', () => {
    expect(notificationListQuerySchema.parse({unreadOnly: 'true'})).toEqual({
      limit: 50,
      unreadOnly: true
    });
    expect(notificationListQuerySchema.safeParse({limit: 101}).success).toBe(false);
  });

  it('accepts only explicit read transitions and non-empty preference patches', () => {
    expect(updateNotificationSchema.safeParse({read: true}).success).toBe(true);
    expect(updateNotificationSchema.safeParse({read: false}).success).toBe(false);
    expect(updateNotificationPreferencesSchema.safeParse({}).success).toBe(false);
    expect(updateNotificationPreferencesSchema.safeParse({inAppEnabled: false}).success).toBe(true);
  });
});
