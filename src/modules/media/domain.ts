import {AppError} from '@/server/errors/app-error';

export const MAX_LISTING_IMAGES = 12;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const allowedImageMediaTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageMediaType = (typeof allowedImageMediaTypes)[number];

export function assertUploadRequest(input: {
  mediaType: string;
  bytes: number;
  sha256: string;
}): asserts input is {
  mediaType: AllowedImageMediaType;
  bytes: number;
  sha256: string;
} {
  if (!allowedImageMediaTypes.includes(input.mediaType as AllowedImageMediaType)) {
    throw new AppError('BAD_REQUEST', 'Only JPEG, PNG and WebP images are supported', 415);
  }
  if (!Number.isSafeInteger(input.bytes) || input.bytes < 1 || input.bytes > MAX_IMAGE_BYTES) {
    throw new AppError('BAD_REQUEST', 'Image must be between 1 byte and 10 MB', 413);
  }
  if (!/^[0-9a-f]{64}$/.test(input.sha256)) {
    throw new AppError('BAD_REQUEST', 'Image checksum must be lowercase SHA-256', 400);
  }
}

export function detectImageMediaType(bytes: Uint8Array): AllowedImageMediaType {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    new TextDecoder('ascii').decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder('ascii').decode(bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }
  throw new AppError('BAD_REQUEST', 'File signature is not a supported image', 415);
}

export function assertUploadMatchesAuthorization(input: {
  expectedBytes: number;
  actualBytes: number;
  expectedSha256: string;
  actualSha256: string;
  declaredMediaType: string;
  detectedMediaType: string;
}): void {
  if (input.actualBytes !== input.expectedBytes) {
    throw new AppError('BAD_REQUEST', 'Uploaded image size does not match authorization', 400);
  }
  if (input.actualSha256 !== input.expectedSha256) {
    throw new AppError('BAD_REQUEST', 'Uploaded image checksum does not match authorization', 400);
  }
  if (input.detectedMediaType !== input.declaredMediaType) {
    throw new AppError('BAD_REQUEST', 'Uploaded image type does not match its file signature', 415);
  }
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}
