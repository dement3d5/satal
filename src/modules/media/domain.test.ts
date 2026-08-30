import {describe, expect, it} from 'vitest';

import {
  assertUploadMatchesAuthorization,
  assertUploadRequest,
  detectImageMediaType,
  MAX_IMAGE_BYTES
} from './domain';

describe('listing media security rules', () => {
  it('accepts bounded supported upload authorization', () => {
    expect(() =>
      assertUploadRequest({mediaType: 'image/jpeg', bytes: 1024, sha256: 'a'.repeat(64)})
    ).not.toThrow();
  });

  it('rejects unsupported media, oversized files and malformed checksums', () => {
    expect(() =>
      assertUploadRequest({mediaType: 'image/svg+xml', bytes: 100, sha256: 'a'.repeat(64)})
    ).toThrow(/JPEG/i);
    expect(() =>
      assertUploadRequest({
        mediaType: 'image/png',
        bytes: MAX_IMAGE_BYTES + 1,
        sha256: 'a'.repeat(64)
      })
    ).toThrow(/10 MB/i);
    expect(() =>
      assertUploadRequest({mediaType: 'image/png', bytes: 100, sha256: 'not-a-checksum'})
    ).toThrow(/SHA-256/i);
  });

  it('uses file signatures rather than trusting client MIME', () => {
    expect(detectImageMediaType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(() => detectImageMediaType(new TextEncoder().encode('<svg></svg>'))).toThrow(
      /signature/i
    );
  });

  it('requires size, checksum and detected type to match authorization', () => {
    expect(() =>
      assertUploadMatchesAuthorization({
        expectedBytes: 10,
        actualBytes: 9,
        expectedSha256: 'a',
        actualSha256: 'a',
        declaredMediaType: 'image/jpeg',
        detectedMediaType: 'image/jpeg'
      })
    ).toThrow(/size/i);
  });
});
