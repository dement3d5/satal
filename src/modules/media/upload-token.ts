import {createHmac, timingSafeEqual} from 'node:crypto';

import {getServerEnvironment} from '@/config/env';
import {AppError} from '@/server/errors/app-error';

export function createUploadToken(assetId: string, expiresAt: Date): string {
  const payload = `${assetId}.${Math.floor(expiresAt.getTime() / 1000)}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyUploadToken(token: string, assetId: string, now = new Date()): void {
  const [tokenAssetId, expiry, signature] = token.split('.');
  if (!tokenAssetId || !expiry || !signature || tokenAssetId !== assetId) {
    throw new AppError('FORBIDDEN', 'Upload authorization is invalid', 403);
  }
  const payload = `${tokenAssetId}.${expiry}`;
  const expected = Buffer.from(sign(payload), 'base64url');
  const received = Buffer.from(signature, 'base64url');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new AppError('FORBIDDEN', 'Upload authorization is invalid', 403);
  }
  if (!/^\d+$/.test(expiry) || Number(expiry) <= Math.floor(now.getTime() / 1000)) {
    throw new AppError('FORBIDDEN', 'Upload authorization has expired', 403);
  }
}

function sign(payload: string): string {
  return createHmac('sha256', getServerEnvironment().AUTH_SECRET)
    .update(`satal-media-upload:${payload}`)
    .digest('base64url');
}
