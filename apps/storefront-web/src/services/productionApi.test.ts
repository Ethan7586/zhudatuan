import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SESSION = {
  actor: 'principal:one',
  session: 'session:one',
  membership: 'membership:one',
  scope: { kind: 'mall', id: 'mall:one' },
  scopes: [{ kind: 'tenant', id: 'tenant:one' }, { kind: 'enterprise', id: 'enterprise:one' }, { kind: 'mall', id: 'mall:one' }],
  accessVersion: 7,
  permissions: ['catalog.listing.read'],
  capabilities: [],
  assurance: { level: 2 },
  target: 'storefront',
  security: { phoneMasked: '138****0000' },
  syncedAt: '2026-08-28T10:00:00.000Z',
  csrf: 'csrf-token-for-storefront',
};

const PROFILE = {
  id: 'member:one',
  display_name: 'Ethan',
  employee_no: 'EMP-001',
  status: 'active',
  mobile_bound: true,
  membership_id: 'membership:one',
  organization_id: 'mall:one',
  access_version: 7,
};

const ACCOUNTS = {
  items: [
    { id: 'account:welfare', kind: 'welfare', currency: 'CNY', available_minor: 20_000, reserved_minor: 0, version: 2, lots: [] },
    { id: 'account:meal', kind: 'meal', currency: 'CNY', available_minor: 5_000, reserved_minor: 0, version: 1, lots: [] },
  ],
};

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.stubEnv('NODE_ENV', 'production');
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  delete process.env.NEXT_PUBLIC_API_ORIGIN;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  delete process.env.NEXT_PUBLIC_API_ORIGIN;
});

describe('canonical storefront production API', () => {
  it('never accepts hbbtzn as the backend API origin', async () => {
    const { resolveProductionApiOrigin } = await import('./canonicalApiClient');

    expect(resolveProductionApiOrigin(undefined, 'production')).toBe('https://api.zhudatuan.com');
    expect(() => resolveProductionApiOrigin('https://api.hbbtzn.com', 'production')).toThrow('API 地址不在允许清单');
  });

  it('uses the same origin when the H5 artifact is served by an L1 façade', async () => {
    const { resolveProductionApiOrigin } = await import('./canonicalApiClient');

    expect(resolveProductionApiOrigin('https://api.zhudatuan.com', 'production', {
      hostname: 'merchant.example',
      origin: 'https://merchant.example',
    })).toBe('https://merchant.example');
  });

  it('loads identity, profile, benefits, ledgers and orders from api.zhudatuan.com with cookie credentials', async () => {
    const fetcher = apiFetch();
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');

    const snapshot = await productionApi.getHomeSnapshot();
    await productionApi.logout();

    expect(snapshot.bootstrap.actor).toMatchObject({ userId: 'member:one', displayName: 'Ethan', phoneMasked: '138****0000' });
    expect(snapshot.accounts.items.map((item) => item.balanceCents)).toEqual([20_000, 5_000]);
    expect(fetcher).toHaveBeenCalledWith('https://api.zhudatuan.com/api/v1/identity/session', expect.objectContaining({ credentials: 'include', redirect: 'error' }));
    const headers = requestHeaders(fetcher, '/api/v1/identity/session');
    expect(headers).toMatchObject({ 'x-client-version': '0.0.0', 'x-contract-version': '1.0.0' });
    expect(requestPaths(fetcher)).toEqual(expect.arrayContaining([
      '/api/v1/identity/session',
      '/api/v1/members/me',
      '/api/v1/benefits/accounts',
      '/api/v1/benefits/ledgers',
      '/api/v1/orders',
    ]));
    expect(requestPaths(fetcher).some((path) => path.startsWith('/api/v1/auth') || path.startsWith('/api/v1/catalog/public'))).toBe(false);
    const logout = requestInit(fetcher, '/api/v1/identity/session', 'DELETE');
    expect(new Headers(logout.headers).get('x-csrf-token')).toBe('csrf-token-for-storefront');
  });

  it('aggregates canonical listings with authoritative offers and inventory', async () => {
    const fetcher = apiFetch();
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    await productionApi.getHomeSnapshot();

    const page = await productionApi.listProducts();

    expect(page.items).toMatchObject([{ id: 'listing:one', skuId: 'sku:one', priceCents: 21900, availableStock: 6, purchasable: true }]);
    expect(requestPaths(fetcher)).toEqual(expect.arrayContaining(['/api/v1/catalog/listings', '/api/v1/pricing/offers', '/api/v1/inventory/availability']));
  });

  it('writes cart and encrypted addresses with CSRF, access version and idempotency', async () => {
    const fetcher = apiFetch();
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    await productionApi.getHomeSnapshot();

    await productionApi.upsertCartItem({ listingId: 'listing:one', quantity: 2 });
    await productionApi.upsertAddress({ id: '', name: '张三', phone: '13800000000', province: '浙江省', city: '杭州市', district: '西湖区', detail: '文一路 1 号', isDefault: true });

    const cart = requestInit(fetcher, '/api/v1/carts/current/items/listing%3Aone', 'PUT');
    expect(Object.fromEntries(new Headers(cart.headers).entries())).toMatchObject({
      'x-access-version': '7',
      'x-csrf-token': 'csrf-token-for-storefront',
      'x-contract-version': '1.0.0',
    });
    expect(new Headers(cart.headers).get('idempotency-key')).toBeTruthy();
    expect(JSON.parse(String(cart.body))).toEqual({ quantity: 2 });
    const address = [...fetcher.mock.calls].find(([url, init]) => new URL(String(url)).pathname.startsWith('/api/v1/members/me/addresses/address%3A') && init?.method === 'PUT');
    expect(address).toBeTruthy();
    expect(JSON.parse(String(address![1]?.body))).toEqual({ recipient: '张三', mobile: '13800000000', address: '文一路 1 号', region: '浙江省/杭州市/西湖区', status: 'active' });
  });

  it('completes quote to order to payment only when the server captures an internal-benefit payment', async () => {
    const fetcher = apiFetch();
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    await productionApi.getHomeSnapshot();

    await expect(productionApi.checkoutWithInternalBenefits({
      addressId: 'address:one',
      items: [{ listingId: 'listing:one', quantity: 1 }],
      idempotencyKey: 'checkout:test',
    })).resolves.toEqual({ orderId: 'order:one', paymentState: 'captured' });
    const writes = fetcher.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url]) => new URL(String(url)).pathname);
    expect(writes).toEqual(['/api/v1/checkouts/quotes', '/api/v1/orders', '/api/v1/payments/intents']);
    for (const [, init] of fetcher.mock.calls.filter(([, value]) => value?.method === 'POST')) {
      const headers = new Headers(init?.headers);
      expect(headers.get('x-csrf-token')).toBe('csrf-token-for-storefront');
      expect(headers.get('idempotency-key')).toBeTruthy();
    }
  });

  it('does not create an order when the authoritative quote requires external payment', async () => {
    const fetcher = apiFetch({ personalMinor: 100 });
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    await productionApi.getHomeSnapshot();

    await expect(productionApi.checkoutWithInternalBenefits({
      addressId: 'address:one',
      items: [{ listingId: 'listing:one', quantity: 1 }],
      idempotencyKey: 'checkout:external',
    })).rejects.toMatchObject({ code: 'EXTERNAL_PAYMENT_REQUIRED' });
    const postOrder = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === '/api/v1/orders' && init?.method === 'POST');
    expect(postOrder).toBeUndefined();
  });

  it('does not report purchase success when the payment intent is not captured', async () => {
    const fetcher = apiFetch({ paymentState: 'reconciling' });
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    await productionApi.getHomeSnapshot();

    await expect(productionApi.checkoutWithInternalBenefits({
      addressId: 'address:one',
      items: [{ listingId: 'listing:one', quantity: 1 }],
      idempotencyKey: 'checkout:pending',
    })).rejects.toMatchObject({ code: 'PAYMENT_NOT_CAPTURED' });
  });
});

function apiFetch(options: { personalMinor?: number; paymentState?: string } = {}) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? 'GET';
    if (path === '/api/v1/identity/session') return json(SESSION);
    if (path === '/api/v1/members/me') return json(PROFILE);
    if (path === '/api/v1/benefits/accounts') return json(ACCOUNTS);
    if (path === '/api/v1/benefits/ledgers') return json({ items: [] });
    if (path === '/api/v1/orders' && method === 'GET') return json({ items: [] });
    if (path === '/api/v1/catalog/listings') return json({ items: [{ id: 'listing:one', sku_id: 'sku:one', title: '空气炸锅', status: 'published', product_type: 'physical', cover_url: null, subtitle: '企业严选' }] });
    if (path === '/api/v1/pricing/offers') return json({ items: [{ sku_id: 'sku:one', amount_minor: 21900, compare_minor: 25900, currency: 'CNY' }] });
    if (path === '/api/v1/inventory/availability') return json({ items: [{ id: 'stock:one', sku_id: 'sku:one', available: 6 }] });
    if (path === '/api/v1/carts/current' && method === 'GET') return json({ id: 'cart:one', version: 3, items: [{ listing: 'listing:one', sku: 'sku:one', quantity: 1, version: 0 }] });
    if (path.startsWith('/api/v1/carts/current/items/') && method === 'PUT') return json({ id: 'cart:one', version: 4 });
    if (path.startsWith('/api/v1/members/me/addresses/') && method === 'PUT') return json({ id: decodeURIComponent(path.split('/').at(-1)!), status: 'active', version: 0 });
    if (path === '/api/v1/checkouts/quotes' && method === 'POST') return json({ quote: { id: 'quote:one', personalMinor: options.personalMinor ?? 0, rejections: [] } }, 201);
    if (path === '/api/v1/orders' && method === 'POST') return json({ id: 'order:one', payment: { intent: 'intent:one', personalMinor: 0 } }, 201);
    if (path === '/api/v1/payments/intents' && method === 'POST') return json({ intent: 'intent:one', state: options.paymentState ?? 'captured', payment: 'payment:one' });
    return json({ code: 'NOT_FOUND', message: 'NOT_FOUND', requestId: 'request:not-found' }, 404);
  });
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'x-request-id': 'request:test' } });
}

function requestPaths(fetcher: ReturnType<typeof apiFetch>): string[] {
  return fetcher.mock.calls.map(([url]) => new URL(String(url)).pathname);
}

function requestHeaders(fetcher: ReturnType<typeof apiFetch>, path: string): Record<string, string> {
  return Object.fromEntries(new Headers(requestInit(fetcher, path).headers).entries());
}

function requestInit(fetcher: ReturnType<typeof apiFetch>, path: string, method = 'GET'): RequestInit {
  const call = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === path && (init?.method ?? 'GET') === method);
  if (!call) throw new Error(`REQUEST_NOT_FOUND:${method}:${path}`);
  return call[1] ?? {};
}
