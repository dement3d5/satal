import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: {
    paths: [
      'password',
      '*.password',
      'otp',
      '*.otp',
      'token',
      '*.token',
      'authorization',
      'headers.authorization',
      'cookie',
      'headers.cookie'
    ],
    censor: '[REDACTED]'
  },
  base: {service: 'satal-web'}
});
