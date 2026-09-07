import {ExternalServiceUnavailableError} from '@/server/errors/app-error';

export type ExternalNotificationChannel = 'email' | 'push';

export interface NotificationDeliveryRequest {
  deliveryId: string;
  notificationId: string;
  recipientId: string;
  type: 'chat_message';
}

export interface NotificationDeliveryResult {
  providerMessageId: string;
}

export interface NotificationDeliveryProvider {
  readonly channel: ExternalNotificationChannel;
  deliver(request: NotificationDeliveryRequest): Promise<NotificationDeliveryResult>;
}

export class DisabledNotificationDeliveryProvider implements NotificationDeliveryProvider {
  constructor(readonly channel: ExternalNotificationChannel) {}

  async deliver(): Promise<never> {
    throw new ExternalServiceUnavailableError(`${this.channel} notification`);
  }
}
