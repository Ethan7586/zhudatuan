import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('hbbtzn H5 alias worker', () => {
  it('serves the WeChat authorization verification file byte-for-byte from the storefront root', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://hbbtzn.com/MP_verify_5ebC4TM1ep4hKgu3.txt'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toBe('5ebC4TM1ep4hKgu3');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forces every storefront document route through the dedicated H5 page', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>H5</html>'));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(new Request('https://hbbtzn.com/desktop-1920?source=desktop'));

    expect((fetchMock.mock.calls[0][0] as Request).url).toBe('https://zhudatuan.com/h5?source=desktop');
  });

  it('publishes storefront HTML metadata on the public H5 hostname', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      '<meta property="og:url" content="https://zhudatuan.com/"/><meta property="og:image" content="https://h5.zhudatuan.com/opengraph-image.png"/>',
      { headers: { 'content-type': 'text/html; charset=utf-8', etag: 'canonical-etag' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://hbbtzn.com/h5'));

    await expect(response.text()).resolves.toContain('https://hbbtzn.com/');
    expect(response.headers.get('etag')).toBeNull();
  });

  it('keeps assets intact and sends API paths to the canonical API', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(new Request('https://hbbtzn.com/assets/app.js'));
    await worker.fetch(new Request('https://hbbtzn.com/api/v1/catalog/listings'));

    expect((fetchMock.mock.calls[0][0] as Request).url).toBe('https://zhudatuan.com/assets/app.js');
    expect((fetchMock.mock.calls[1][0] as Request).url).toBe('https://api.zhudatuan.com/api/v1/catalog/listings');
  });

  it('sends public API paths to the canonical API while preserving the public request origin', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(new Request('https://hbbtzn.com/api/v1/catalog/listings', {
      headers: { origin: 'https://hbbtzn.com' },
    }));

    const upstreamRequest = fetchMock.mock.calls[0][0] as Request;
    expect(upstreamRequest.url).toBe('https://api.zhudatuan.com/api/v1/catalog/listings');
    expect(upstreamRequest.headers.get('origin')).toBe('https://zhudatuan.com');
  });

  it.each([
    ['https://accounts.hbbtzn.com/assets/auth.js', 'https://accounts.zhudatuan.com/assets/auth.js'],
    ['https://api.hbbtzn.com/api/v1/identity/sessions', 'https://api.zhudatuan.com/api/v1/identity/sessions'],
    ['https://console.hbbtzn.com/assets/console.js', 'https://console.zhudatuan.com/assets/console.js'],
  ])('proxies tenant control-plane alias %s to %s', async (source, destination) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request(source));

    expect(response.status).toBe(200);
    expect((fetchMock.mock.calls[0][0] as Request).url).toBe(destination);
  });

  it('rewrites canonical control origins inside JavaScript bundles', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      "const api='https://api.zhudatuan.com';const auth='https://accounts.zhudatuan.com';",
      { headers: {
        'content-type': 'application/javascript; charset=utf-8',
        'content-encoding': 'gzip',
        etag: 'canonical-script-etag',
      } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://console.hbbtzn.com/assets/AppConfig.js'));

    await expect(response.text()).resolves.toBe(
      "const api='https://api.hbbtzn.com';const auth='https://accounts.hbbtzn.com';",
    );
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('etag')).toBeNull();
  });

  it('gives Hongtai control assets an independent browser cache path', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(
        '<script src="/assets/index.js"></script><link href="/assets/index.css" rel="stylesheet">',
        { headers: { 'content-type': 'text/html; charset=utf-8' } },
      ))
      .mockResolvedValueOnce(new Response('console bundle'));
    vi.stubGlobal('fetch', fetchMock);

    const documentResponse = await worker.fetch(new Request('https://console.hbbtzn.com/cockpit', {
      headers: { accept: 'text/html', 'if-none-match': 'old-console-etag' },
    }));
    await expect(documentResponse.text()).resolves.toContain('src="/__hbbtzn-v1/assets/index.js"');
    expect((fetchMock.mock.calls[0][0] as Request).headers.get('if-none-match')).toBeNull();
    await expect(worker.fetch(new Request('https://console.hbbtzn.com/__hbbtzn-v1/assets/index.js')))
      .resolves.toMatchObject({ status: 200 });
    expect((fetchMock.mock.calls[1][0] as Request).url).toBe('https://console.zhudatuan.com/assets/index.js');
  });

  it('rewrites only the identity ticket return target to the Hongtai console', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      returnTarget: {
        url: 'https://console.zhudatuan.com/scopes/mall/mall%3Ahongtai/cockpit',
        proof: 'signed-proof',
        expiresAt: '2026-09-06T03:00:00.000Z',
      },
    }), { headers: { 'content-type': 'application/json; charset=utf-8' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://api.hbbtzn.com/api/v1/identity/tickets/exchange', {
      method: 'POST',
    }));

    await expect(response.json()).resolves.toMatchObject({
      returnTarget: { url: 'https://console.hbbtzn.com/scopes/mall/mall%3Ahongtai/cockpit' },
    });
  });

  it('opens the Hongtai console at its fixed mall scope', async () => {
    const response = await worker.fetch(new Request('https://console.hbbtzn.com/'));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://console.hbbtzn.com/scopes/mall/mall%3Ad1708f04df2dd8a61736852c4900fb43/cockpit',
    );
  });

  it('routes Hongtai console login through its own accounts and admin origins', async () => {
    const response = await worker.fetch(new Request('https://accounts.hbbtzn.com/login?client=console'));

    expect(response.status).toBe(308);
    const target = new URL(response.headers.get('location')!);
    expect(target.origin).toBe('https://accounts.hbbtzn.com');
    expect(target.searchParams.get('client')).toBe('console-hbbtzn');
    expect(target.searchParams.get('admin_origin')).toBe('https://console.hbbtzn.com');
  });

  it('routes the Hongtai consumer account page through canonical identity with its own application', async () => {
    const response = await worker.fetch(new Request(
      'https://hbbtzn.com/accounts/?target=storefront&surface=web&application=zhudatuan-storefront',
    ));

    expect(response.status).toBe(308);
    const target = new URL(response.headers.get('location')!);
    expect(target.origin).toBe('https://accounts.zhudatuan.com');
    expect(target.pathname).toBe('/');
    expect(target.searchParams.get('target')).toBe('storefront');
    expect(target.searchParams.get('surface')).toBe('web');
    expect(target.searchParams.get('application')).toBe('zdt-l1-verify');
  });

  it('preserves a canonical account origin for public API preflight', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (request) => {
      expect((request as Request).headers.get('origin')).toBe('https://accounts.zhudatuan.com');
      return new Response(null, { status: 204,
        headers: { 'access-control-allow-origin': 'https://accounts.zhudatuan.com' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://hbbtzn.com/api/v1/identity/sessions', {
      method: 'OPTIONS', headers: { origin: 'https://accounts.zhudatuan.com' },
    }));

    expect(response.headers.get('access-control-allow-origin')).toBe('https://accounts.zhudatuan.com');
  });

  it('restores the public root origin after canonical API approval', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (request) => {
      expect((request as Request).headers.get('origin')).toBe('https://zhudatuan.com');
      return new Response(null, { status: 204,
        headers: { 'access-control-allow-origin': 'https://zhudatuan.com' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://hbbtzn.com/api/v1/identity/sessions', {
      method: 'OPTIONS', headers: { origin: 'https://hbbtzn.com' },
    }));

    expect(response.headers.get('access-control-allow-origin')).toBe('https://hbbtzn.com');
  });

  it('moves the old mall hostname to the one H5 storefront hostname', async () => {
    const response = await worker.fetch(new Request('https://mall.hbbtzn.com/orders?from=qr'));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://hbbtzn.com/orders?from=qr');
  });

  it.each([
    ['https://hbbtzn.zhudatuan.com/products/sku-1', 'https://hbbtzn.com/products/sku-1'],
    ['https://console-hbbtzn.zhudatuan.com/orders', 'https://console.hbbtzn.com/orders'],
  ])('upgrades the platform domain %s to the brand domain %s', async (source, destination) => {
    const response = await worker.fetch(new Request(source));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(destination);
  });
});
