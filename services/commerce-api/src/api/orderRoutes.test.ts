import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleCreateOrder, handleInternalPayment } from './orderRoutes';
import type { AuthorizationContext, WorkerEnv } from './types';

const env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  PII_ENCRYPTION_KEY: btoa('12345678901234567890123456789012'),
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

describe('phone assurance at order boundaries', () => {
  it('blocks order creation before inventory, PII, or order RPC work', async () => {
    const database = accountOnlyDatabase();
    vi.stubGlobal('fetch', database);
    const response = await handleCreateOrder(new Request('https://hbbtzn.com/api/v1/orders', { method: 'POST' }), env, authorization, 'unverified-order');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'PHONE_VERIFICATION_REQUIRED' } });
    expect(database).toHaveBeenCalledTimes(1);
    expect(String((database.mock.calls as unknown[][])[0]?.[0])).toContain('/rpc/api_member_assurance');
  });

  it('blocks internal payment before looking up the order or debiting an account', async () => {
    const database = accountOnlyDatabase();
    vi.stubGlobal('fetch', database);
    const response = await handleInternalPayment(new Request('https://hbbtzn.com/api/v1/orders/order-one/pay-internal', { method: 'POST' }), env, authorization, 'unverified-payment', 'unverified-payment');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'PHONE_VERIFICATION_REQUIRED' } });
    expect(database).toHaveBeenCalledTimes(1);
    expect(String((database.mock.calls as unknown[][])[0]?.[0])).toContain('/rpc/api_member_assurance');
  });
});

describe('order cart closure', () => {
  it('removes only ordered SKU rows after idempotent order creation succeeds', async () => {
    const database = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/rpc/api_member_assurance')) {
        return new Response(JSON.stringify({ phoneVerified: true, paymentEligible: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.includes('/rpc/api_create_order_and_clear_cart_authorized')) {
        return new Response(JSON.stringify({ order: { id: 'order-one', orderNo: 'SW202608150001', status: 'pending_payment' }, cartItemsRemoved: 1 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', database);
    const request = new Request('https://hbbtzn.com/api/v1/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'checkout-order-one' },
      body: JSON.stringify({
        items: [{ skuId: 'sku-one', quantity: 1 }],
        recipient: { name: '测试用户', mobile: '13800000000', province: '湖北省', city: '武汉市', district: '武昌区', address: '测试地址 1 号' },
      }),
    });

    const response = await handleCreateOrder(request, env, authorization, 'checkout-request');

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ order: { id: 'order-one' }, cartItemsRemoved: 1 });
    expect(database.mock.calls.map((call) => String(call[0]))).toEqual([expect.stringContaining('/rpc/api_member_assurance'), expect.stringContaining('/rpc/api_create_order_and_clear_cart_authorized')]);
  });
});

function accountOnlyDatabase() {
  return vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          level: 'account',
          accountAuthenticated: true,
          accountAuthenticatedAt: '2026-08-13T00:00:00Z',
          phoneVerified: false,
          phoneVerifiedAt: null,
          phoneVerificationMethod: null,
          paymentEligible: false,
          restrictedCapabilities: ['order.create', 'payment.execute'],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
  );
}
