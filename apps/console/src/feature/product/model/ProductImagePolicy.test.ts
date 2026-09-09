import { describe, expect, it } from 'vitest';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { productImageContentType, productImageError } from './ProductImagePolicy';

describe('product image policy', () => {
  it.each([
    ['主图.png', 'image/png', 'image/png'],
    ['主图.jpg', 'image/jpeg', 'image/jpeg'],
    ['主图.JPEG', 'image/jpeg', 'image/jpeg'],
  ] as const)('accepts %s when its browser type and extension agree', (name, type, expected) => {
    expect(productImageContentType({ name, type, size: 8 })).toBe(expected);
  });

  it('rejects empty, oversized, mismatched and unsupported files with beginner-friendly guidance', () => {
    expect(productImageError({ name: '主图.png', type: 'image/png', size: 0 })).toContain('不可为空');
    expect(productImageError({ name: '主图.png', type: 'image/png', size: RUNTIME_LIMITS.upload.maximumImageBytes + 1 })).toContain('不得超过');
    expect(productImageError({ name: '主图.jpg', type: 'image/png', size: 8 })).toContain('JPG');
    expect(productImageError({ name: '主图.gif', type: 'image/gif', size: 8 })).toContain('PNG');
  });
});
