import {ExternalServiceUnavailableError} from '@/server/errors/app-error';

export interface SmsProvider {
  sendOtp(input: {phoneNumber: string; code: string}): Promise<void>;
}

export const disabledSmsProvider: SmsProvider = {
  async sendOtp() {
    throw new ExternalServiceUnavailableError('SMS');
  }
};
