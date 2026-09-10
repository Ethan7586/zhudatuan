import { describe, expect, it, vi } from 'vitest';
import type { CatalogReadPort, StorefrontListing } from '../../public/CatalogReadPort';
import { StorefrontCatalogMedia } from './StorefrontCatalogMedia';

describe('StorefrontCatalogMedia', () => {
  it('resolves object-backed covers once and keeps direct links as a fallback', async () => {
    const page = Object.freeze({
      items: Object.freeze([
        listing('listing:object', { coverObject: 'object:cover' }, 'https://legacy.test/cover.png'),
        listing('listing:broken', { coverObject: 'object:broken' }, 'https://legacy.test/fallback.png'),
        listing('listing:direct', {}, 'https://assets.test/direct.png'),
      ]),
      next: Object.freeze({ sort: '2030-01-01T00:00:00.000Z', id: 'listing:direct' }),
    });
    const categories = vi.fn(async () => Object.freeze([]));
    const listings = vi.fn(async () => page);
    const links = vi.fn(async () => new Map([['object:cover', 'https://objects.test/signed-cover.png']]));
    const reader = new StorefrontCatalogMedia({ categories, listings } as CatalogReadPort, { links });

    const result = await reader.listings({} as never, {} as never);

    expect(links).toHaveBeenCalledExactlyOnceWith(['object:cover', 'object:broken']);
    expect(result).toEqual({
      items: [
        expect.objectContaining({ id: 'listing:object', coverUrl: 'https://objects.test/signed-cover.png', attributes: {} }),
        expect.objectContaining({ id: 'listing:broken', coverUrl: 'https://legacy.test/fallback.png', attributes: {} }),
        expect.objectContaining({ id: 'listing:direct', coverUrl: 'https://assets.test/direct.png', attributes: {} }),
      ],
      next: page.next,
    });
  });

  it('delegates category reads without involving media storage', async () => {
    const categories = vi.fn(async () => Object.freeze([{ id: 'category:gifts', code: 'gifts', name: '员工关怀', count: 2 }]));
    const listings = vi.fn();
    const links = vi.fn();
    const reader = new StorefrontCatalogMedia({ categories, listings } as unknown as CatalogReadPort, { links });
    const input = { mall: 'mall:one', pool: 'pool:one', query: null, account: null, exclusive: false } as const;

    await expect(reader.categories({} as never, input)).resolves.toEqual([{ id: 'category:gifts', code: 'gifts', name: '员工关怀', count: 2 }]);
    expect(categories).toHaveBeenCalledExactlyOnceWith({}, input);
    expect(links).not.toHaveBeenCalled();
  });
});

function listing(id: string, attributes: Readonly<Record<string, unknown>>, coverUrl: string | null): StorefrontListing {
  return Object.freeze({
    id,
    sku: `sku:${id}`,
    product: `product:${id}`,
    title: '暖心生活关怀礼盒',
    subtitle: null,
    coverUrl,
    kind: 'physical',
    categoryId: 'category:gifts',
    categoryCode: 'gifts',
    categoryName: '员工关怀',
    brandId: null,
    supplierId: null,
    attributes: Object.freeze(attributes),
    specifications: Object.freeze({}),
    version: '1',
    updatedAt: '2030-01-01T00:00:00.000Z',
  });
}
