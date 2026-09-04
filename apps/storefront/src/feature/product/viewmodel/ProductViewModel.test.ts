import { describe, expect, it } from 'vitest';
import type { ProductPort } from '../public/ProductPort';
import { ReadProduct } from '../application/ReadProduct';

describe('ProductViewModel reader', () => {
  it('preserves an authoritative empty product instead of inventing a fallback', async () => {
    const gateway: ProductPort = { read: () => Promise.resolve(null) };
    await expect(new ReadProduct(gateway).execute('product:missing')).resolves.toBeNull();
  });
});
