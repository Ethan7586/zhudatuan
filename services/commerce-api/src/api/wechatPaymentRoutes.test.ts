import { PAYMENT_STATUS, toPaymentStatus } from '@smart-wing/api-contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routeStorefrontRequest } from './routes/storefrontRouter';
import type { AuthorizationContext, WorkerEnv } from './types';
import { handleOrderByNumber, handleWechatPaymentStatus } from './wechatPaymentRoutes';

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
  permissions: ['order.read', 'order.create'],
  stepUpAt: null,
  membership: {
    id: 'membership-one',
    memberId: 'member-one',
    target: 'storefront',
    status: 'active',
    roleIds: ['employee'],
    permissions: ['order.read', 'order.create'],
    deniedPermissions: [],
    expiresAt: null,
    authzVersion: 1,
    context: { tenantId: 'tenant-one', enterpriseId: 'enterprise-one', mallId: 'mall-one', userId: 'user-one' },
    scopeBindings: [{ kind: 'self', resourceId: 'user-one' }],
  },
} satisfies AuthorizationContext;

afterEach(() => vi.unstubAllGlobals());

describe('commerce payment contract', () => {
  it('maps storage and order states to one client vocabulary', () => {
    expect(toPaymentStatus('prepay_ready', 'pending_payment')).toBe(PAYMENT_STATUS.pending);
    expect(toPaymentStatus('succeeded', 'pending_payment')).toBe(PAYMENT_STATUS.paid);
    expect(toPaymentStatus('created', 'refunded')).toBe(PAYMENT_STATUS.refunded);
  });

  it('returns an owned order detail with canonical payment status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          id: 'order-one',
          orderNo: 'SW202608140001',
          status: 'pending_payment',
          payableCents: 8800,
          items: [],
          wechatPayment: { status: 'prepay_ready' },
        })
      )
    );
    const response = await handleOrderByNumber(new Request('https://hbbtzn.com/api/v1/orders/by-number/SW202608140001'), env, authorization, 'SW202608140001', 'order-detail');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ order: { id: 'order-one', paymentStatus: 'pending' } });
  });

  it('returns payment status through the exact mini-program route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          orderId: 'order-one',
          orderNo: 'SW202608140001',
          orderStatus: 'paid',
          paymentStatus: 'succeeded',
          needsQuery: false,
          totalCents: 8800,
        })
      )
    );
    const request = new Request('https://hbbtzn.com/api/v1/orders/order-one/payment-status');
    const response = await routeStorefrontRequest(request, env, authorization, 'payment-status');
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({ orderId: 'order-one', status: 'paid', providerSync: 'not_needed' });
  });

  it('keeps the direct handler consistent with the routed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          orderId: 'order-two',
          orderNo: 'SW202608140002',
          orderStatus: 'pending_payment',
          paymentStatus: 'closed',
          needsQuery: false,
        })
      )
    );
    const response = await handleWechatPaymentStatus(new Request('https://hbbtzn.com/api/v1/orders/order-two/payment-status'), env, authorization, 'order-two', 'payment-closed');
    await expect(response.json()).resolves.toMatchObject({ status: 'closed' });
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
}
