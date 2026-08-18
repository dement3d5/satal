import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {betterAuth} from 'better-auth/minimal';
import {phoneNumber} from 'better-auth/plugins';

import {getServerEnvironment} from '@/config/env';
import {getDatabase} from '@/server/db/client';
import {authSchema} from '@/server/db/schema';

import {disabledSmsProvider} from './sms-provider';

const internationalPhoneNumber = /^\+[1-9]\d{7,14}$/;

const environment = getServerEnvironment();

export const auth = betterAuth({
  appName: 'Satal',
  baseURL: environment.APP_ORIGIN,
  secret: environment.AUTH_SECRET,
  database: drizzleAdapter(getDatabase(), {
    provider: 'pg',
    schema: authSchema
  }),
  advanced: {
    database: {generateId: 'uuid'}
  },
  plugins: [
    phoneNumber({
      expiresIn: 300,
      allowedAttempts: 5,
      requireVerification: true,
      phoneNumberValidator: (value) => internationalPhoneNumber.test(value),
      sendOTP: (input) => disabledSmsProvider.sendOtp(input),
      signUpOnVerification: {
        getTempEmail: (value) => `${value.replace(/\D/g, '')}@phone.invalid`
      }
    })
  ]
});
