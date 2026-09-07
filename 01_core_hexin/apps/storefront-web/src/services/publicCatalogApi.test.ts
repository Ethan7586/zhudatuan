import { afterEach, describe, expect, it, vi } from 'vitest';
import { listPublicProducts } from './publicCatalogApi';

const publicPayload = {
  items: [{
    id: 'listing:one',
    skuId: 'sku:one',
    name: '主打团货盘',
    subtitle: '商城闭环验证商品',
    categoryCode: 'welfare',
    coverUrl: 'https://images.unsplash.com/photo-one?w=600',
    priceCents: 1,
    marketPriceCents: 1,
    availableStock: 7,
    supplierName: '平台自营',
    isTest: false,
    purchasable: false,
    qualification: {
      visible: true,
      purchasable: false,
      visibilityReason: 'PUBLIC_CATALOG',
      purchaseReason: 'LOGIN_REQUIRED',
    },
  }],
  pagination: { nextCursor: null },
};

afterEach(() => vi.unstubAllGlobals());

describe('public catalog bootstrap', () => {
  it('reuses the response started by the document head', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    vi.stubGlobal('window', {
      __SW_PUBLIC_CATALOG_RESPONSE__: Promise.resolve(new Response(JSON.stringify(publicPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })),
    });

    const page = await listPublicProducts({ limit: 100 });

    expect(page.items[0]).toMatchObject({ id: 'listing:one', coverUrl: 'https://images.unsplash.com/photo-one?w=600' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
