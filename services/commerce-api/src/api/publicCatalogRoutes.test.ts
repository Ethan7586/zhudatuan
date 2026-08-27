import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPublicCatalogCache, handlePublicCatalog } from './publicCatalogRoutes';
import { routeApi } from './router';
import type { WorkerEnv } from './types';

afterEach(() => {
  vi.unstubAllGlobals();
  clearPublicCatalogCache();
});

const env: WorkerEnv = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  MINIAPP_SESSION_SIGNING_KEY: 'miniapp-test-signing-key-that-is-longer-than-32-bytes',
};

const catalogRow = {
  id: 'product-one',
  sku_id: 'sku-one',
  name: '公开商品',
  name_en: null,
  name_zh: '公开商品',
  subtitle: '所有访客可见',
  subtitle_en: null,
  subtitle_zh: '所有访客可见',
  category_code: 'food',
  taxonomy_l1: 'food',
  taxonomy_l2: 'food_snack',
  taxonomy_l3: 'food_snack_nuts',
  classification_status: 'approved',
  cover_url: 'https://m.media-amazon.com/images/I/product-one.jpg',
  price_cents: 2590,
  market_price_cents: 2990,
  available_stock: 12,
  supplier_name: '公开供应商',
  is_test: false,
};

describe('public catalog', () => {
  it('returns the shared Shop catalog without creating a member session', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify([catalogRow]), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await routeApi(new Request('https://hbbtzn.com/api/v1/catalog/public/products?limit=24'), env);

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      items: [
        {
          id: 'product-one',
          priceCents: 2590,
          purchasable: false,
          qualification: { visible: true, purchasable: false, visibilityReason: 'PUBLIC_CATALOG', purchaseReason: 'LOGIN_REQUIRED' },
        },
      ],
      access: { mode: 'public', memberPricing: false, purchaseQualification: false },
    });
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://db.example/rest/v1/rpc/api_public_catalog_window');
    expect(requestBody).toEqual({ p_mall_slug: 'smart-wing-demo', p_limit: 24, p_offset: 0 });
  });

  it('rejects malformed server-side mall configuration before database access', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await handlePublicCatalog(new Request('https://hbbtzn.com/api/v1/catalog/public/products'), { ...env, PUBLIC_MALL_SLUG: '../secret' }, 'bad-mall');

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'PUBLIC_CATALOG_NOT_CONFIGURED' } });
  });

  it('defaults public browsing to a small first-screen batch', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify([catalogRow]), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handlePublicCatalog(new Request('https://hbbtzn.com/api/v1/catalog/public/products'), env, 'small-default');

    expect(response.status).toBe(200);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ p_limit: 24, p_offset: 0 });
    await expect(response.json()).resolves.toMatchObject({ pagination: { limit: 24 } });
  });

  it('keeps writes disabled on the public catalog endpoint', async () => {
    const response = await handlePublicCatalog(new Request('https://hbbtzn.com/api/v1/catalog/public/products', { method: 'POST' }), env, 'catalog-method');

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });

  it('caps public batches at 200 and reuses the short-lived server cache', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ ...catalogRow, id: `product-${index}`, sku_id: `sku-${index}` }));
    const secondPage = Array.from({ length: 50 }, (_, index) => ({ ...catalogRow, id: `product-${index + 100}`, sku_id: `sku-${index + 100}` }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(secondPage), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('https://hbbtzn.com/api/v1/catalog/public/products?limit=999');

    const first = await handlePublicCatalog(request, env, 'cache-first');
    const second = await handlePublicCatalog(request, env, 'cache-second');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first.headers.get('x-sw-catalog-cache')).toBe('miss');
    expect(second.headers.get('x-sw-catalog-cache')).toBe('hit');
    expect(second.headers.get('cache-control')).toContain('max-age=60');
    expect(second.headers.get('server-timing')).toMatch(/^catalog;dur=\d+$/);
    await expect(first.json()).resolves.toMatchObject({ items: { length: 150 }, pagination: { cursor: 0, nextCursor: null, limit: 200 } });
    const firstRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const secondRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(firstRequest).toMatchObject({ p_limit: 100, p_offset: 0 });
    expect(secondRequest).toMatchObject({ p_limit: 100, p_offset: 100 });
  });

  it('serves a Beijing shared-cache hit without crossing regions to Supabase', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            cache: 'fresh',
            envelope: {
              schemaVersion: 2,
              projectionVersion: 'catalog.shared-test',
              sourceCursor: 'cursor:0:limit:20:items:1',
              contentHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              generatedAt: '2026-08-15T00:00:00.000Z',
              storedAt: Date.now(),
              expiresAt: Date.now() + 60_000,
              staleUntil: Date.now() + 600_000,
              data: [catalogRow],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    );
    vi.stubGlobal('fetch', fetchMock);
    const cacheEnv = { ...env, CORE_READ_CACHE_URL: 'http://127.0.0.1:3002', CORE_READ_CACHE_TOKEN: 'internal-cache-token' };

    const response = await handlePublicCatalog(new Request('https://hbbtzn.com/api/v1/catalog/public/products?limit=20'), cacheEnv, 'shared-hit');

    expect(response.headers.get('x-sw-catalog-cache-tier')).toBe('shared');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('127.0.0.1:3002/v1/entries/');
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('supabase'))).toBe(false);
  });

  it('publishes a verifiable mirror contract and honors conditional requests', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([catalogRow]), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const first = await handlePublicCatalog(new Request('https://hbbtzn.com/api/v1/catalog/public/products?limit=24'), env, 'etag-first');
    const etag = first.headers.get('etag');
    const body = (await first.json()) as { mirror: Record<string, unknown> };
    expect(etag).toMatch(/^"catalog\.[a-f0-9]{24}"$/);
    expect(body.mirror).toMatchObject({ schemaVersion: 2, catalogVersion: etag?.slice(1, -1), sourceCursor: 'cursor:0:limit:24:items:1' });
    expect(body.mirror.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);

    const second = await handlePublicCatalog(new Request('https://hbbtzn.com/api/v1/catalog/public/products?limit=24', { headers: { 'if-none-match': String(etag) } }), env, 'etag-second');
    expect(second.status).toBe(304);
    expect(second.headers.get('etag')).toBe(etag);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps category-specific browsing on the canonical taxonomy query', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify([catalogRow]), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handlePublicCatalog(new Request('https://hbbtzn.com/api/v1/catalog/public/products?category=food&limit=20'), env, 'food-category');

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://db.example/rest/v1/rpc/api_catalog');
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      p_mall_slug: 'smart-wing-demo',
      p_category: 'food',
      p_limit: 20,
      p_offset: 0,
    });
  });

  it('serves signed first-party image URLs without exposing an open proxy', async () => {
    const imageBytes = new Uint8Array([255, 216, 255, 217]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([catalogRow]), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(imageBytes, { status: 200, headers: { 'content-length': String(imageBytes.byteLength), 'content-type': 'image/jpeg' } }));
    vi.stubGlobal('fetch', fetchMock);

    const catalogResponse = await routeApi(new Request('http://hbbtzn.com/api/v1/catalog/public/products?limit=1'), env);
    const catalogBody = (await catalogResponse?.json()) as { items: Array<{ coverUrl: string }> };
    expect(catalogBody.items[0].coverUrl).toContain('https://hbbtzn.com/api/v1/catalog/public/products/product-one/image?');

    const imageResponse = await routeApi(new Request(catalogBody.items[0].coverUrl), env);
    expect(imageResponse?.status).toBe(200);
    expect(imageResponse?.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await imageResponse!.arrayBuffer())).toEqual(imageBytes);
    expect(fetchMock.mock.calls[1]?.[0]).toEqual(new URL(catalogRow.cover_url));

    const tampered = new URL(catalogBody.items[0].coverUrl);
    tampered.searchParams.set('source', 'https://m.media-amazon.com/images/I/other.jpg');
    const rejected = await routeApi(new Request(tampered), env);
    expect(rejected?.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns the same configured CDN image URL to Web and mini-program clients', async () => {
    const cdnRow = {
      ...catalogRow,
      cover_url: 'https://img.hbbtzn.com/catalog/products/product-one/cover-abc123.webp',
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([cdnRow]), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handlePublicCatalog(new Request('https://hbbtzn.com/api/v1/catalog/public/products?limit=1'), { ...env, PUBLIC_MEDIA_BASE_URL: 'https://img.hbbtzn.com' }, 'shared-cdn');
    const body = (await response.json()) as { items: Array<{ coverUrl: string }> };

    expect(body.items[0].coverUrl).toBe(cdnRow.cover_url);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a controlled gateway error when the approved image host is unavailable', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([catalogRow]), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockRejectedValueOnce(new TypeError('upstream unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    const catalogResponse = await routeApi(new Request('http://hbbtzn.com/api/v1/catalog/public/products?limit=1'), env);
    const catalogBody = (await catalogResponse?.json()) as { items: Array<{ coverUrl: string }> };
    const imageResponse = await routeApi(new Request(catalogBody.items[0].coverUrl), env);

    expect(imageResponse?.status).toBe(502);
    await expect(imageResponse?.json()).resolves.toMatchObject({ error: { code: 'CATALOG_IMAGE_UPSTREAM_FAILED' } });
  });
});
