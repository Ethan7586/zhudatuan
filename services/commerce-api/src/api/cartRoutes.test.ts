import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleCart } from './cartRoutes';
import type { AuthorizationContext, WorkerEnv } from './types';

const env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
} satisfies WorkerEnv;

const authorization = {
  tenantId: 'tenant-one',
  enterpriseId: 'enterprise-one',
  mallId: 'mall-one',
  mallCode: 'MALL',
  userId: 'user-one',
  employeeNo: 'E-001',
  roles: ['employee'],
  permissions: ['order.create'],
  stepUpAt: null,
  membership: {
    id: 'membership-one',
    memberId: 'member-one',
    target: 'storefront',
    status: 'active',
    roleIds: ['employee'],
    permissions: ['order.create'],
    deniedPermissions: [],
    expiresAt: null,
    authzVersion: 1,
    context: { tenantId: 'tenant-one', enterpriseId: 'enterprise-one', mallId: 'mall-one', userId: 'user-one' },
    scopeBindings: [{ kind: 'self', resourceId: 'user-one' }],
  },
} satisfies AuthorizationContext;

afterEach(() => vi.unstubAllGlobals());

describe('cart snapshot', () => {
  it('returns the qualified server projection without inventing product fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                id: 'cart-item-one',
                skuId: 'sku-one',
                productId: 'product-one',
                name: '真实商品',
                coverUrl: 'https://hbbtzn.com/media/product-one.webp',
                priceCents: 1250,
                availableStock: 8,
                quantity: 2,
                selected: true,
                purchasable: true,
              },
            ]),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
      )
    );

    const response = await handleCart(new Request('https://hbbtzn.com/api/v1/cart'), env, authorization, 'cart-request');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [{ id: 'cart-item-one', name: '真实商品', priceCents: 1250, coverUrl: 'https://hbbtzn.com/media/product-one.webp' }],
      requestId: 'cart-request',
    });
  });
});
