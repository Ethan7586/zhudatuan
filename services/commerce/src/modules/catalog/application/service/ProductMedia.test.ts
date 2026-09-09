import { describe, expect, it, vi } from 'vitest';
import type { AssetPort, ObjectMetadata } from '../../../runtime/public';
import { ProductMedia, type ProductImage } from './ProductMedia';

describe('ProductMedia', () => {
  it('accepts only a receipt that exactly matches the clean stored image', async () => {
    const image = productImage();
    const verify = vi.fn(async () => metadata(image));
    const media = new ProductMedia({ verify } as unknown as AssetPort);

    await expect(media.verify(image)).resolves.toBe('object:cover');
    expect(verify).toHaveBeenCalledExactlyOnceWith(image);
  });

  it.each([
    ['path', { path: 'tenant/other/asset/image.png' }],
    ['hash', { sha256: 'b'.repeat(64) }],
    ['size', { size: 9 }],
    ['type', { contentType: 'application/pdf' }],
    ['retention', { retentionUntil: '2031-01-01T00:00:00.000Z' }],
  ])('rejects a forged %s receipt', async (_field, changed) => {
    const image = productImage();
    const media = new ProductMedia({ verify: vi.fn(async () => metadata(image, changed)) } as unknown as AssetPort);
    await expect(media.verify(image)).rejects.toMatchObject({ code: 'VALIDATION_FAILED', details: { field: 'image' } });
  });

  it('isolates individual signing failures and returns every usable image link', async () => {
    const link = vi.fn(async (reference: string) => {
      if (reference === 'object:broken') throw new Error('object offline');
      return { url: `https://objects.test/${reference}`, expiresAt: '2030-01-01T00:15:00.000Z' };
    });
    const media = new ProductMedia({ link } as unknown as AssetPort);

    await expect(media.links(['object:cover', 'object:broken', 'object:cover'])).resolves.toEqual(new Map([['object:cover', 'https://objects.test/object:cover']]));
    expect(link).toHaveBeenCalledTimes(2);
  });
});

function productImage(): ProductImage {
  return {
    reference: 'object:cover',
    path: 'tenant/owner/asset/2030/01/01/image.png',
    sha256: 'a'.repeat(64),
    size: 8,
    contentType: 'image/png',
    retentionUntil: '2030-12-31T00:00:00.000Z',
  };
}

function metadata(image: ProductImage, changed: Partial<ObjectMetadata> = {}): ObjectMetadata {
  return { ...image, scan: 'clean', lockedUntil: null, ...changed };
}
