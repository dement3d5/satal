import sharp from 'sharp';
import {describe, expect, it} from 'vitest';

import {createSafeImageVariants} from './processor';

describe('safe image processing', () => {
  it('decodes and re-encodes bounded WebP variants without source metadata', async () => {
    const source = await sharp({
      create: {width: 40, height: 20, channels: 3, background: '#176b4d'}
    })
      .jpeg()
      .withMetadata({orientation: 6})
      .toBuffer();

    const result = await createSafeImageVariants(source);
    expect(result).toMatchObject({width: 20, height: 40});
    expect(result.variants.map((variant) => variant.kind)).toEqual(['thumbnail', 'card', 'detail']);
    for (const variant of result.variants) {
      const metadata = await sharp(variant.bytes).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.orientation).toBeUndefined();
      expect(metadata.exif).toBeUndefined();
      expect(variant.width).toBe(20);
      expect(variant.height).toBe(40);
    }
  });

  it('rejects input that a real image decoder cannot parse', async () => {
    await expect(
      createSafeImageVariants(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))
    ).rejects.toThrow();
  });
});
