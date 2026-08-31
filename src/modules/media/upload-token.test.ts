import {describe, expect, it} from 'vitest';

import {createUploadToken, verifyUploadToken} from './upload-token';

const secret = 'test-only-secret-that-is-longer-than-thirty-two-characters';
const assetId = '8d19c64a-6f10-4efa-890f-b257c128b338';
const expiresAt = new Date('2030-01-01T00:10:00.000Z');

describe('media upload authorization', () => {
  it('accepts a matching unexpired capability', () => {
    const token = createUploadToken(assetId, expiresAt, secret);
    expect(() =>
      verifyUploadToken(token, assetId, new Date('2030-01-01T00:09:59.000Z'), secret)
    ).not.toThrow();
  });

  it('rejects tampering, a different asset and expiry', () => {
    const token = createUploadToken(assetId, expiresAt, secret);
    expect(() => verifyUploadToken(`${token}x`, assetId, new Date('2029-01-01'), secret)).toThrow(
      /invalid/i
    );
    expect(() =>
      verifyUploadToken(
        token,
        '3ea2b1af-7d0d-40fb-bac2-65df0c9a697d',
        new Date('2029-01-01'),
        secret
      )
    ).toThrow(/invalid/i);
    expect(() => verifyUploadToken(token, assetId, expiresAt, secret)).toThrow(/expired/i);
  });
});
