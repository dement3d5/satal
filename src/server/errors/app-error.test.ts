import {describe, expect, it} from 'vitest';

import {ExternalServiceUnavailableError} from './app-error';

describe('ExternalServiceUnavailableError', () => {
  it('fails closed when a provider is disabled', () => {
    const error = new ExternalServiceUnavailableError('SMS');

    expect(error.code).toBe('SERVICE_UNAVAILABLE');
    expect(error.status).toBe(503);
    expect(error.message).toContain('SMS');
  });
});
