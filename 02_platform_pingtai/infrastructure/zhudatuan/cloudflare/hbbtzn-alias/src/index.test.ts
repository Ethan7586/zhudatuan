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

    await worker.fetch(new Request('https://hbbtzn.com/desktop-1920?source=desktop', {
      headers: {
        'x-sfl-node-id': 'node:zhudatuan:l0',
        'x-sfl-node-surface': 'web-business',
      },
    }));

    const upstreamRequest = fetchMock.mock.calls[0][0] as Request;
    expect(upstreamRequest.url).toBe('https://zhudatuan.com/h5?source=desktop');
    expect(upstreamRequest.headers.get('x-sfl-node-id')).toBe('node:hbbtzn:l1');
    expect(upstreamRequest.headers.get('x-sfl-node-surface')).toBe('storefront');
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
    expect((fetchMock.mock.calls[0][0] as Request).headers.get('x-sfl-node-surface')).toBe('storefront');
    expect((fetchMock.mock.calls[1][0] as Request).headers.get('x-sfl-node-surface')).toBe('web-business');
  });

  it('sends the Hongtai storefront catalog to its L1 web runtime without rewriting its origin', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(new Request('https://hbbtzn.com/api/v1/catalog/listings', {
      headers: { origin: 'https://hbbtzn.com' },
    }));

    const upstreamRequest = fetchMock.mock.calls[0][0] as Request;
    expect(upstreamRequest.url).toBe('https://api.zhudatuan.com/api/v1/catalog/listings');
    expect(upstreamRequest.headers.get('origin')).toBe('https://hbbtzn.com');
    expect(upstreamRequest.headers.get('x-sfl-node-id')).toBe('node:hbbtzn:l1');
    expect(upstreamRequest.headers.get('x-sfl-node-surface')).toBe('web-business');
    expect(upstreamRequest.headers.get('x-zdt-identity-entry-host')).toBe('hbbtzn.com');
  });

  it('sends Hongtai console catalog operations to its L1 catalog runtime', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, {
      status: 204,
      headers: { 'access-control-allow-origin': 'https://console.hbbtzn.com' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://api.hbbtzn.com/api/v1/catalog/imports', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://console.hbbtzn.com',
        'x-sfl-node-id': 'node:zhudatuan:l0',
        'x-sfl-node-surface': 'web-business',
      },
    }));

    const upstreamRequest = fetchMock.mock.calls[0][0] as Request;
    expect(upstreamRequest.headers.get('origin')).toBe('https://console.hbbtzn.com');
    expect(upstreamRequest.headers.get('x-sfl-node-id')).toBe('node:hbbtzn:l1');
    expect(upstreamRequest.headers.get('x-sfl-node-surface')).toBe('catalog-operator');
    expect(response.headers.get('access-control-allow-origin')).toBe('https://console.hbbtzn.com');
  });

  it('separates Hongtai catalog reads from operator mutations on the API alias', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(new Request('https://api.hbbtzn.com/api/v1/catalog/listings', {
      headers: { origin: 'https://console.hbbtzn.com' },
    }));
    await worker.fetch(new Request('https://api.hbbtzn.com/api/v1/catalog/listings/listing%3A1/publication', {
      method: 'DELETE',
      headers: { origin: 'https://console.hbbtzn.com' },
    }));

    const readRequest = fetchMock.mock.calls[0][0] as Request;
    expect(readRequest.headers.get('x-sfl-node-surface')).toBe('web-business');
    const mutationRequest = fetchMock.mock.calls[1][0] as Request;
    expect(mutationRequest.headers.get('x-sfl-node-surface')).toBe('catalog-operator');
  });

  it('marks Hongtai-only catalog media for its L1 storefront route', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('image'));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(new Request('https://hbbtzn.com/catalog-media/mockpool-test-product.svg'));

    const upstreamRequest = fetchMock.mock.calls[0][0] as Request;
    expect(upstreamRequest.url).toBe('https://zhudatuan.com/catalog-media/mockpool-test-product.svg');
    expect(upstreamRequest.headers.get('x-sfl-node-id')).toBe('node:hbbtzn:l1');
    expect(upstreamRequest.headers.get('x-sfl-node-surface')).toBe('web-business');
  });
  it('keeps shared Hongtai identity calls on the canonical routing contract', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(new Request('https://api.hbbtzn.com/api/v1/identity/session', {
      headers: {
        origin: 'https://console.hbbtzn.com',
        'x-sfl-node-id': 'node:injected',
        'x-sfl-node-surface': 'catalog-operator',
      },
    }));

    const upstreamRequest = fetchMock.mock.calls[0][0] as Request;
    expect(upstreamRequest.headers.get('origin')).toBe('https://console.zhudatuan.com');
    expect(upstreamRequest.headers.get('x-sfl-node-id')).toBeNull();
    expect(upstreamRequest.headers.get('x-sfl-node-surface')).toBeNull();
    expect(upstreamRequest.headers.get('x-zdt-identity-entry-host')).toBe('api.hbbtzn.com');
  });

  it('keeps order creation on the shared purchase runtime while isolating order reads', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(new Request('https://hbbtzn.com/api/v1/orders', {
      method: 'POST',
      headers: { origin: 'https://hbbtzn.com' },
    }));
    await worker.fetch(new Request('https://hbbtzn.com/api/v1/orders', {
      headers: { origin: 'https://hbbtzn.com' },
    }));

    const createRequest = fetchMock.mock.calls[0][0] as Request;
    expect(createRequest.headers.get('origin')).toBe('https://zhudatuan.com');
    expect(createRequest.headers.get('x-sfl-node-id')).toBeNull();
    const readRequest = fetchMock.mock.calls[1][0] as Request;
    expect(readRequest.headers.get('origin')).toBe('https://hbbtzn.com');
    expect(readRequest.headers.get('x-sfl-node-surface')).toBe('web-business');
  });

  it.each([
    ['https://accounts.hbbtzn.com/assets/auth.js', 'https://accounts.zhudatuan.com/assets/auth.js'],
    ['https://api.hbbtzn.com/api/v1/identity/sessions', 'https://api.zhudatuan.com/api/v1/identity/sessions'],
    ['https://console.hbbtzn.com/assets/console.js', 'https://console.zhudatuan.com/assets/console.js'],
    ['https://console.hbbtzn.com/api/v1/auth/session', 'https://api.zhudatuan.com/api/v1/auth/session'],
  ])('proxies tenant control-plane alias %s to %s', async (source, destination) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request(source));

    expect(response.status).toBe(200);
    const upstreamRequest = fetchMock.mock.calls[0][0] as Request;
    expect(upstreamRequest.url).toBe(destination);
    expect(upstreamRequest.headers.get('x-zdt-identity-entry-host'))
      .toBe(source.includes('/api/') ? 'api.hbbtzn.com' : null);
  });

  it('binds the Hongtai console document and assets to its L1 operator surface', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(new Request('https://console.hbbtzn.com/products'));
    await worker.fetch(new Request('https://console.hbbtzn.com/assets/console.js'));

    for (const call of fetchMock.mock.calls) {
      const upstreamRequest = call[0] as Request;
      expect(upstreamRequest.headers.get('x-sfl-node-id')).toBe('node:hbbtzn:l1');
      expect(upstreamRequest.headers.get('x-sfl-node-surface')).toBe('catalog-operator');
    }
  });

  it('serves the shared Console JavaScript artifact byte-for-byte without node rewriting', async () => {
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
      "const api='https://api.zhudatuan.com';const auth='https://accounts.zhudatuan.com';",
    );
    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(response.headers.get('etag')).toBe('canonical-script-etag');
  });

  it('serves Console NodeManifest evidence byte-for-byte without changing its digest inputs', async () => {
    const source = JSON.stringify({
      source_sha: 'a'.repeat(40),
      immutable_artifact_digest: `sha256:${'b'.repeat(64)}`,
      node_manifest_registry: { manifests: [] },
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(source, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        etag: 'canonical-console-manifest-etag',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://console.hbbtzn.com/console-build.json'));

    await expect(response.text()).resolves.toBe(source);
    expect(response.headers.get('etag')).toBe('canonical-console-manifest-etag');
  });

  it('preserves both node origins inside the shared identity JavaScript bundle', async () => {
    const source = [
      "const l0='https://zhudatuan.com';",
      "const l1='https://hbbtzn.com';",
      "const api='https://api.zhudatuan.com';",
    ].join('');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(source, {
      headers: {
        'content-type': 'application/javascript; charset=utf-8',
        etag: 'shared-identity-script-etag',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://accounts.hbbtzn.com/assets/identity.js'));

    await expect(response.text()).resolves.toBe(source);
    expect(response.headers.get('etag')).toBe('shared-identity-script-etag');
  });

  it('serves the shared Console document and assets without changing artifact paths', async () => {
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
    await expect(documentResponse.text()).resolves.toContain('src="/assets/index.js"');
    expect((fetchMock.mock.calls[0][0] as Request).headers.get('if-none-match')).toBeNull();
    await expect(worker.fetch(new Request('https://console.hbbtzn.com/assets/index.js')))
      .resolves.toMatchObject({ status: 200 });
    expect((fetchMock.mock.calls[1][0] as Request).url).toBe('https://console.zhudatuan.com/assets/index.js');
  });

  it('never rewrites the server-signed identity ticket return target across nodes', async () => {
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
      returnTarget: { url: 'https://console.zhudatuan.com/scopes/mall/mall%3Ahongtai/cockpit' },
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
    expect(target.origin).toBe('https://accounts.hbbtzn.com');
    expect(target.pathname).toBe('/');
    expect(target.searchParams.get('target')).toBe('storefront-hbbtzn');
    expect(target.searchParams.get('surface')).toBe('web');
    expect(target.searchParams.get('application')).toBe('zdt-l1-verify');
  });

  it('upgrades only the legacy Hongtai consumer link to the L1 target', async () => {
    const response = await worker.fetch(new Request(
      'https://accounts.hbbtzn.com/?target=storefront&surface=web&application=zdt-l1-verify',
    ));

    expect(response.status).toBe(308);
    const target = new URL(response.headers.get('location')!);
    expect(target.origin).toBe('https://accounts.hbbtzn.com');
    expect(target.searchParams.get('target')).toBe('storefront-hbbtzn');
    expect(target.searchParams.get('application')).toBe('zdt-l1-verify');
  });

  it('keeps an unsigned L0 consumer link inside the L1 accounts hostname', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request(
      'https://accounts.hbbtzn.com/?target=storefront&application=zhudatuan-storefront',
    ));

    expect(response.status).toBe(308);
    const target = new URL(response.headers.get('location')!);
    expect(target.origin).toBe('https://accounts.hbbtzn.com');
    expect(target.searchParams.get('target')).toBe('storefront-hbbtzn');
    expect(target.searchParams.get('surface')).toBe('web');
    expect(target.searchParams.get('application')).toBe('zdt-l1-verify');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('upgrades legacy L0 console parameters to the L1 console on the L1 accounts hostname', async () => {
    const response = await worker.fetch(new Request(
      'https://accounts.hbbtzn.com/?target=console&admin_origin=https%3A%2F%2Fconsole.zhudatuan.com',
    ));

    expect(response.status).toBe(308);
    const target = new URL(response.headers.get('location')!);
    expect(target.searchParams.get('target')).toBe('console-hbbtzn');
    expect(target.searchParams.get('admin_origin')).toBe('https://console.hbbtzn.com');
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
