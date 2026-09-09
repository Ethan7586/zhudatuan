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
  organization_name: '宏泰甄选',
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
  it('loads identity, profile, benefits, ledgers and orders from api.hbbtzn.com with cookie credentials', async () => {
    const fetcher = apiFetch();
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');

    const snapshot = await productionApi.getHomeSnapshot();
    await productionApi.logout();

    expect(snapshot.bootstrap.actor).toMatchObject({ userId: 'member:one', displayName: 'Ethan', phoneMasked: '138****0000' });
    expect(snapshot.bootstrap.scope.mallName).toBe('宏泰甄选');
    expect(snapshot.accounts.items.map((item) => item.balanceCents)).toEqual([20_000, 5_000]);
    expect(fetcher).toHaveBeenCalledWith('https://api.hbbtzn.com/api/v1/identity/session', expect.objectContaining({ credentials: 'include', redirect: 'error' }));
    const headers = requestHeaders(fetcher, '/api/v1/identity/session');
    expect(headers).toMatchObject({
      'x-client-version': process.env.NEXT_PUBLIC_CLIENT_VERSION ?? '0.0.0',
      'x-contract-version': '1.0.0',
    });
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

  it('publishes the identity shell first and reuses it for the heavier home snapshot', async () => {
    vi.stubEnv('NEXT_PUBLIC_STOREFRONT_APPLICATION', 'zdt-l1-verify');
    const fetcher = apiFetch({ profile: { ...PROFILE, organization_name: undefined } });
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');

    const session = await productionApi.getSession();
    expect(session.bootstrap.scope).toMatchObject({ mallName: '宏泰甄选', brandName: '宏泰甄选' });
    expect(requestPaths(fetcher)).toEqual(['/api/v1/identity/session', '/api/v1/members/me']);

    await productionApi.getHomeSnapshot(session.bootstrap);
    expect(requestPaths(fetcher).filter((path) => path === '/api/v1/identity/session')).toHaveLength(1);
    expect(requestPaths(fetcher).filter((path) => path === '/api/v1/members/me')).toHaveLength(1);
  });

  it('binds password login to the current storefront application', async () => {
    vi.stubEnv('NEXT_PUBLIC_STOREFRONT_APPLICATION', 'zdt-l1-verify');
    const fetcher = apiFetch();
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');

    await productionApi.login({ username: '13800138000', password: 'CurrentPasswordA' });

    const request = requestInit(fetcher, '/api/v1/identity/sessions', 'POST');
    expect(JSON.parse(String(request.body))).toMatchObject({
      provider: 'password', target: 'storefront', application: 'zdt-l1-verify', subject: '13800138000',
    });
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

  it('loads the public catalog without waiting for an authenticated session', async () => {
    const fetcher = vi.fn(async () => json({
      items: [{
        id: 'listing:public', skuId: 'sku:public', name: '宏泰甄选礼包', subtitle: '企业福利', categoryCode: 'gift', coverUrl: null,
        priceCents: 9_900, marketPriceCents: 10_900, availableStock: 20, supplierName: '宏泰甄选', isTest: false, purchasable: true,
        qualification: { visible: true, purchasable: true, visibilityReason: 'PUBLIC_CATALOG', purchaseReason: 'QUALIFIED' },
      }],
      pagination: { nextCursor: null },
    }));
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');

    const page = await productionApi.listPublicProducts();

    expect(page.items).toMatchObject([{ id: 'listing:public', skuId: 'sku:public', name: '宏泰甄选礼包' }]);
    expect(fetcher).toHaveBeenCalledWith('/api/v1/catalog/public/products?limit=100', expect.objectContaining({ credentials: 'omit', method: 'GET' }));
  });

  it('writes cart and encrypted addresses with CSRF, access version and idempotency', async () => {
    const fetcher = apiFetch();
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    await productionApi.getHomeSnapshot();

    await productionApi.upsertCartItem({ listingId: 'listing:one', quantity: 2 });
    await productionApi.upsertAddress({ id: '', name: '张三', phone: '13800000000', province: '浙江省', city: '杭州市', district: '西湖区', detail: '文一路 1 号', isDefault: true });
    await expect(productionApi.setDefaultAddress('address:two', 4)).resolves.toEqual({
      id: 'address:two', isDefault: true, version: 5,
    });

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
    expect(JSON.parse(String(address![1]?.body))).toEqual({ recipient: '张三', mobile: '13800000000', address: '文一路 1 号', region: '浙江省/杭州市/西湖区', isDefault: true, status: 'active' });
    const defaultAddress = requestInit(fetcher, '/api/v1/members/me/addresses/address%3Atwo', 'PUT');
    expect(JSON.parse(String(defaultAddress.body))).toEqual({ isDefault: true });
    expect(new Headers(defaultAddress.headers).get('if-match')).toBe('"4"');
  });

  it('raises the current password session to phone assurance before payment', async () => {
    const fetcher = apiFetch();
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    await productionApi.getHomeSnapshot();

    await expect(productionApi.startPaymentPhoneVerification()).resolves.toEqual({
      challengeId: 'challenge:payment-stepup',
      expiresAt: '2026-09-03T14:10:00.000Z',
    });
    await expect(productionApi.completePaymentPhoneVerification('challenge:payment-stepup', '123456')).resolves.toEqual({ verified: true });

    const start = requestInit(fetcher, '/api/v1/identity/stepup/challenges', 'POST');
    const complete = requestInit(fetcher, '/api/v1/identity/stepup/verifications', 'POST');
    expect(new Headers(start.headers).get('x-csrf-token')).toBe('csrf-token-for-storefront');
    expect(JSON.parse(String(complete.body))).toEqual({ challenge: 'challenge:payment-stepup', code: '123456' });
  });

  it('submits WeChat binding with phone verification as one operation', async () => {
    const fetcher = apiFetch();
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    await productionApi.getHomeSnapshot();

    await expect(productionApi.completePaymentPhoneVerification(
      'challenge:wechat-stepup', '654321', 'wechat-binding-token'
    )).resolves.toEqual({ verified: true });

    const complete = requestInit(fetcher, '/api/v1/identity/stepup/verifications', 'POST');
    expect(JSON.parse(String(complete.body))).toEqual({
      challenge: 'challenge:wechat-stepup', code: '654321', bindingToken: 'wechat-binding-token',
    });
  });

  it('obtains and binds a WeChat identity grant to the authenticated L6 membership', async () => {
    vi.stubEnv('NEXT_PUBLIC_STOREFRONT_APPLICATION', 'zdt-l1-verify');
    const fetcher = apiFetch();
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    const { beginH5WechatAuthorization, requestH5WechatAuthorization, exchangeH5WechatCode, bindH5WechatIdentity } = await import('./h5WechatIdentity');
    await productionApi.getHomeSnapshot();

    const authorization = await beginH5WechatAuthorization();
    await expect(requestH5WechatAuthorization(authorization, 'authenticated')).resolves.toBe('https://open.weixin.qq.com/connect/oauth2/authorize');
    const exchanged = await exchangeH5WechatCode('wechatCode123', authorization, 'authenticated');
    expect(exchanged).toEqual({ kind: 'binding', bindingToken: 'wechat-binding-token', confirmationRequired: false });
    if (exchanged.kind === 'binding') await bindH5WechatIdentity(exchanged.bindingToken);

    const binding = requestInit(fetcher, '/api/v1/identity/wechat/bindings', 'POST');
    expect(new Headers(binding.headers).get('x-csrf-token')).toBe('csrf-token-for-storefront');
    expect(JSON.parse(String(binding.body))).toEqual({ bindingToken: 'wechat-binding-token' });
    const sessions = fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname === '/api/v1/identity/wechat/sessions');
    expect(sessions).toHaveLength(2);
    for (const [, init] of sessions) {
      expect(new Headers(init?.headers).get('x-csrf-token')).toBe('csrf-token-for-storefront');
      expect(new Headers(init?.headers).get('idempotency-key')).toBeTruthy();
      expect(JSON.parse(String(init?.body))).toMatchObject({ mode: 'authenticated' });
    }
    expect(JSON.parse(String(sessions[1]?.[1]?.body))).toMatchObject({
      application: 'zdt-l1-verify', target: 'storefront',
    });
  });

  it('requests a server-signed openAddress JS-SDK configuration for the exact page URL', async () => {
    const fetcher = apiFetch();
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    const { requestH5WechatJsSdkConfiguration } = await import('./h5WechatIdentity');
    await productionApi.getHomeSnapshot();

    await expect(requestH5WechatJsSdkConfiguration('https://hbbtzn.com/?source=wechat')).resolves.toEqual({
      appId: 'wx4df4137881a1d2bd',
      timestamp: 1_788_800_000,
      nonceStr: 'nonce-one',
      signature: 'a'.repeat(40),
      jsApiList: ['openAddress'],
    });
    const request = requestInit(fetcher, '/api/v1/identity/wechat/sessions', 'POST');
    expect(JSON.parse(String(request.body))).toMatchObject({
      scene: 'jsapi', action: 'jssdk_config', url: 'https://hbbtzn.com/?source=wechat',
    });
  });

  it('completes quote to order to payment only when the server captures an internal-benefit payment', async () => {
    const fetcher = apiFetch();
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    await productionApi.getHomeSnapshot();

    await expect(productionApi.checkout({
      addressId: 'address:one',
      items: [{ listingId: 'listing:one', quantity: 1 }],
      idempotencyKey: 'checkout:test',
    })).resolves.toEqual({ orderId: 'order:one', paymentId: 'intent:one', paymentState: 'captured' });
    const writes = fetcher.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url]) => new URL(String(url)).pathname);
    expect(writes).toEqual(['/api/v1/checkouts/quotes', '/api/v1/orders', '/api/v1/payments/intents']);
    for (const [, init] of fetcher.mock.calls.filter(([, value]) => value?.method === 'POST')) {
      const headers = new Headers(init?.headers);
      expect(headers.get('x-csrf-token')).toBe('csrf-token-for-storefront');
      expect(headers.get('idempotency-key')).toBeTruthy();
    }
  });

  it('creates the external-payment order, invokes WeChat once, and reports authorizing without claiming paid', async () => {
    const fetcher = apiFetch({ personalMinor: 100 });
    const invoke = wechatBridge('get_brand_wcpay_request:ok');
    const onPaymentProgress = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    await productionApi.getHomeSnapshot();

    await expect(productionApi.checkout({
      addressId: 'address:one',
      items: [{ listingId: 'listing:one', quantity: 1 }],
      idempotencyKey: 'checkout:external',
      onPaymentProgress,
    })).resolves.toEqual({
      orderId: 'order:one', paymentId: 'intent:one', paymentState: 'authorizing',
      wechatOutcome: { status: 'returned', errMsg: 'get_brand_wcpay_request:ok', code: 'WECHAT_PAYMENT_RETURNED' },
    });
    const postOrder = fetcher.mock.calls.find(([url, init]) => new URL(String(url)).pathname === '/api/v1/orders' && init?.method === 'POST');
    expect(postOrder).toBeTruthy();
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith('getBrandWCPayRequest', expect.objectContaining({
      appId: 'wx-public-mall', package: 'prepay_id=public-mall', paySign: 'signed',
    }), expect.any(Function));
    expect(onPaymentProgress.mock.calls.map(([progress]) => progress.stage)).toEqual([
      'creating-payment', 'opening-wechat', 'wechat-active',
    ]);
  });

  it('reports reconciling without reopening WeChat when the server is already querying an uncertain result', async () => {
    const fetcher = apiFetch({ personalMinor: 100, paymentState: 'reconciling' });
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    await productionApi.getHomeSnapshot();

    await expect(productionApi.checkout({
      addressId: 'address:one',
      items: [{ listingId: 'listing:one', quantity: 1 }],
      idempotencyKey: 'checkout:pending',
    })).resolves.toEqual({ orderId: 'order:one', paymentId: 'intent:one', paymentState: 'reconciling' });
  });

  it('reads the payment result only from the canonical payment query', async () => {
    const fetcher = apiFetch();
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    await productionApi.getHomeSnapshot();

    await expect(productionApi.readPaymentResult('intent:one')).resolves.toEqual({
      intentId: 'intent:one', orderId: 'order:one', paymentId: 'payment:one', state: 'captured', paymentState: 'captured',
      amountMinor: 100, currency: 'CNY', action: null, expiresAt: '2026-09-05T12:00:00.000Z', retryAfter: 0,
    });
  });

  it('preserves the created order and reports an explicit cancellation when the user closes WeChat Pay', async () => {
    const fetcher = apiFetch({ personalMinor: 100 });
    wechatBridge('get_brand_wcpay_request:cancel');
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    await productionApi.getHomeSnapshot();

    await expect(productionApi.checkout({
      addressId: 'address:one',
      items: [{ listingId: 'listing:one', quantity: 1 }],
      idempotencyKey: 'checkout:cancelled',
    })).resolves.toEqual({
      orderId: 'order:one', paymentId: 'intent:one', paymentState: 'authorizing',
      wechatOutcome: { status: 'cancelled', errMsg: 'get_brand_wcpay_request:cancel', code: 'PAYMENT_CANCELLED' },
    });
    expect(requestInit(fetcher, '/api/v1/orders', 'POST')).toBeTruthy();
  });

  it('restarts payment for the original order without creating another order', async () => {
    const fetcher = apiFetch({ personalMinor: 100 });
    wechatBridge('get_brand_wcpay_request:ok');
    vi.stubGlobal('fetch', fetcher);
    const { productionApi } = await import('./productionApi');
    await productionApi.getHomeSnapshot();

    await expect(productionApi.continuePayment({
      orderId: 'order:one', amountMinor: 100, currency: 'CNY', idempotencyKey: 'checkout:one:retry:1',
    })).resolves.toMatchObject({ orderId: 'order:one', paymentId: 'intent:one', paymentState: 'authorizing' });

    expect(requestPaths(fetcher).filter((path) => path === '/api/v1/orders')).toEqual(['/api/v1/orders']);
    expect(requestPaths(fetcher).filter((path) => path === '/api/v1/checkouts/quotes')).toEqual([]);
    const retry = requestInit(fetcher, '/api/v1/payments/intents', 'POST');
    expect(new Headers(retry.headers).get('idempotency-key')).toBe('checkout:one:retry:1');
  });
});

function apiFetch(options: { personalMinor?: number; paymentState?: string; profile?: Record<string, unknown> } = {}) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? 'GET';
    if (path === '/api/v1/identity/sessions' && method === 'POST') return json({
      target: 'storefront', callback: { ticket: 'ticket:one', state: 's'.repeat(43) },
    }, 201);
    if (path === '/api/v1/identity/tickets/exchange' && method === 'POST') return json({ session: 'session:one' });
    if (path === '/api/v1/identity/session') return json(SESSION);
    if (path === '/api/v1/members/me') return json(options.profile ?? PROFILE);
    if (path === '/api/v1/benefits/accounts') return json(ACCOUNTS);
    if (path === '/api/v1/benefits/ledgers') return json({ items: [] });
    if (path === '/api/v1/orders' && method === 'GET') return json({ items: [] });
    if (path === '/api/v1/catalog/listings') return json({ items: [{ id: 'listing:one', sku_id: 'sku:one', title: '空气炸锅', status: 'published', product_type: 'physical', cover_url: null, subtitle: '企业严选' }] });
    // PostgreSQL bigint values arrive over JSON as decimal strings in production.
    if (path === '/api/v1/pricing/offers') return json({ items: [{ sku_id: 'sku:one', amount_minor: '21900', compare_minor: '25900', currency: 'CNY' }] });
    if (path === '/api/v1/inventory/availability') return json({ items: [{ id: 'stock:one', sku_id: 'sku:one', available: '6' }] });
    if (path === '/api/v1/carts/current' && method === 'GET') return json({ id: 'cart:one', version: 3, items: [{ listing: 'listing:one', sku: 'sku:one', quantity: 1, version: 0 }] });
    if (path.startsWith('/api/v1/carts/current/items/') && method === 'PUT') return json({ id: 'cart:one', version: 4 });
    if (path.startsWith('/api/v1/members/me/addresses/') && method === 'PUT') {
      const body = JSON.parse(String(init?.body)) as { isDefault?: boolean; recipient?: string };
      return json({ id: decodeURIComponent(path.split('/').at(-1)!), is_default: body.isDefault === true, status: 'active', version: body.recipient ? 0 : 5 });
    }
    if (path === '/api/v1/identity/stepup/challenges' && method === 'POST') return json({ id: 'challenge:payment-stepup', expires_at: '2026-09-03T14:10:00.000Z' }, 202);
    if (path === '/api/v1/identity/stepup/verifications' && method === 'POST') return json({ id: 'session:one', assurance_level: 3 });
    if (path === '/api/v1/identity/wechat/sessions' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { action: string };
      if (body.action === 'jssdk_config') return json({
        appId: 'wx4df4137881a1d2bd', timestamp: 1_788_800_000, nonceStr: 'nonce-one', signature: 'a'.repeat(40), jsApiList: ['openAddress'],
      });
      return body.action === 'authorize'
        ? json({ authorizationUrl: 'https://open.weixin.qq.com/connect/oauth2/authorize' })
        : json({ bindingToken: 'wechat-binding-token', expiresIn: 600, state: 'registration_required' }, 202);
    }
    if (path === '/api/v1/identity/wechat/bindings' && method === 'POST') return json({ identity: 'wechat:one', status: 'active' });
    if (path === '/api/v1/checkouts/quotes' && method === 'POST') return json({ quote: { id: 'quote:one', personalMinor: options.personalMinor ?? 0, rejections: [] } }, 201);
    if (path === '/api/v1/orders' && method === 'POST') return json({ id: 'order:one', payment: {
      intent: 'intent:one', personalMinor: options.personalMinor ?? 0,
    } }, 201);
    if (path === '/api/v1/payments/intents' && method === 'POST') {
      if ((options.personalMinor ?? 0) > 0 && options.paymentState === undefined) return json({
        intent: 'intent:one', parameters: {
          appId: 'wx-public-mall', timeStamp: '1788336000', nonceStr: 'public-mall', package: 'prepay_id=public-mall',
          signType: 'RSA', paySign: 'signed', providerRequestId: 'provider:one',
        },
      }, 201);
      return json({ intent: 'intent:one', state: options.paymentState ?? 'captured', payment: 'payment:one' });
    }
    if (path === '/api/v1/payments/intents/intent%3Aone' && method === 'GET') return json({
      intentId: 'intent:one', orderId: 'order:one', paymentId: 'payment:one', state: 'captured', paymentState: 'captured',
      amountMinor: 100, currency: 'CNY', action: null, expiresAt: '2026-09-05T12:00:00.000Z', retryAfter: 0,
    });
    return json({ code: 'NOT_FOUND', message: 'NOT_FOUND', requestId: 'request:not-found' }, 404);
  });
}

function wechatBridge(message: string) {
  const invoke = vi.fn((_operation: string, _parameters: Record<string, string>, callback: (result: Record<string, string>) => void) => {
    callback({ err_msg: message });
  });
  vi.stubGlobal('window', {
    WeixinJSBridge: { invoke },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });
  return invoke;
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
