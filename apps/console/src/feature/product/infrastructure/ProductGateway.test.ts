import { HttpResponse, http } from 'msw';
import { File as NodeFile } from 'node:buffer';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Listing, Pool } from '../model/Product';
import type { ProductCommand } from '../public';
import { listingFixture } from '../test/ProductFixture';
import { ProductGateway } from './ProductGateway';

interface RecordedRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Headers;
  readonly body: unknown;
}
const requests: RecordedRequest[] = [];
const objectUploads: Readonly<{ headers: Headers; bytes: Uint8Array }>[] = [];
const server = setupServer(
  http.all('*/api/v1/catalog/**', async ({ request }) => {
    const url = new URL(request.url);
    const body = request.body === null ? null : await request.json();
    requests.push({ method: request.method, path: url.pathname, headers: request.headers, body });
    if (url.pathname.endsWith('/categories')) return request.method === 'GET' ? HttpResponse.json({ items: [category], count: 1 }) : HttpResponse.json(category, { status: 201 });
    if (url.pathname.endsWith('/mediauploads')) {
      const image = body as { name: string; contentType: 'image/png'; size: number; sha256: string };
      return HttpResponse.json(
        {
          reference: 'object:cover',
          path: 'tenant/owner/asset/2030/01/01/cover.png',
          sha256: image.sha256,
          size: image.size,
          contentType: image.contentType,
          retentionUntil: '2030-12-31T00:00:00.000Z',
          upload: { url: 'https://objects.test/upload', method: 'PUT', headers: { 'content-type': image.contentType }, expiresAt: '2030-01-01T00:05:00.000Z' },
        },
        { status: 201 }
      );
    }
    if (url.pathname.endsWith('/batches')) {
      const input = body as { phase: 'preview' | 'execute'; action: 'publish' | 'unpublish' };
      return HttpResponse.json({
        phase: input.phase === 'preview' ? 'preview' : 'executed',
        action: input.action,
        previewHash: 'b'.repeat(64),
        items: [{ id: 'listing:one', state: input.phase === 'preview' ? 'ready' : 'succeeded', status: 'published', version: input.phase === 'preview' ? 3 : 4, error: null, gaps: [] }],
        count: 1,
        failed: 0,
      });
    }
    if (url.pathname.endsWith('/price')) return HttpResponse.json(price);
    if (url.pathname.endsWith('/pool')) return HttpResponse.json(listingRecord);
    if (url.pathname.includes('/bindings/')) return HttpResponse.json(binding);
    if (url.pathname.endsWith('/allocations')) return HttpResponse.json(poolRecord, { status: 201 });
    if (url.pathname.endsWith('/publication')) return HttpResponse.json(listingRecord);
    return HttpResponse.json(url.pathname.endsWith('/products') ? productRecord : { ...productRecord, status: request.method === 'DELETE' ? 'archived' : 'active' });
  }),
  http.put('https://objects.test/upload', async ({ request }) => {
    objectUploads.push({ headers: request.headers, bytes: new Uint8Array(await request.arrayBuffer()) });
    return new HttpResponse(null, { status: 204 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
  objectUploads.length = 0;
});
afterAll(() => server.close());

describe('ProductGateway commands', () => {
  it('reads human-readable category choices and creates a category through generated operations', async () => {
    const gateway = createGateway();
    const categories = await gateway.readCategories({ scope: { kind: 'platform', id: 'platform:shop' }, accessVersion: 7 }, new AbortController().signal);
    const created = await gateway.createCategory({ ...command('category'), scope: { kind: 'platform', id: 'platform:shop' } }, { name: '办公用品', parent: null, sort: 10 });

    expect(categories).toEqual({ items: [category], count: 1 });
    expect(created).toEqual(category);
    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual(['GET /api/v1/catalog/categories', 'POST /api/v1/catalog/categories']);
    expect(requests[1]?.body).toEqual({ name: '办公用品', parent: null, sort: 10 });
    expect(requests[1]?.headers.get('idempotency-key')).toBe('command:category');
  });

  it('connects create, edit and archive to real operations with command and version evidence', async () => {
    const gateway = createGateway();
    await gateway.createProduct(command('create'), { title: '办公福利礼盒', category: 'category:office', type: 'physical' });
    await gateway.updateProduct(command('edit'), listing, 7, { title: '办公福利礼盒·新版', category: 'category:office', status: 'active' });
    await gateway.archiveProduct(command('archive'), listing, 8);

    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual(['POST /api/v1/catalog/products', 'PATCH /api/v1/catalog/products/product%3Aone', 'DELETE /api/v1/catalog/products/product%3Aone']);
    expect(requests.map(({ headers }) => headers.get('idempotency-key'))).toEqual(['command:create', 'command:edit', 'command:archive']);
    expect(requests.map(({ headers }) => headers.get('if-match'))).toEqual([null, '"7"', '"8"']);
  });

  it('uploads a validated product image to the signed OSS target and forwards only its immutable receipt', async () => {
    const gateway = createGateway();
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new NodeFile([bytes], '礼盒.png', { type: 'image/png' }) as unknown as File;
    const progress: Readonly<{ stage: string; processed: number; total: number }>[] = [];

    const image = await gateway.uploadProductImage(command('image'), file, undefined, (value) => progress.push(value));
    await gateway.createProduct(command('create-image'), { title: '节日礼盒', category: 'category:festival', type: 'physical', image });

    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual(['POST /api/v1/catalog/mediauploads', 'POST /api/v1/catalog/products']);
    expect(requests[0]?.body).toMatchObject({ name: '礼盒.png', contentType: 'image/png', size: bytes.byteLength, sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) });
    expect(objectUploads).toHaveLength(1);
    expect(objectUploads[0]?.headers.get('content-type')).toBe('image/png');
    expect(objectUploads[0]?.bytes).toEqual(bytes);
    expect(progress).toContainEqual({ stage: 'uploading', processed: 0, total: bytes.byteLength });
    expect(requests[1]?.body).toEqual({ title: '节日礼盒', category: 'category:festival', type: 'physical', image });
    expect(requests[1]?.body).not.toHaveProperty('upload');
  });

  it('connects publication, pricing and pool writes without preview-only fallbacks', async () => {
    const gateway = createGateway();
    await gateway.changePublication(command('publish'), [listing], true);
    await gateway.changePublication(command('unpublish'), [listing], false);
    await gateway.publishPrice(command('price'), listing, 9900, 4);
    await gateway.changeListingPool(command('move'), listing, 'pool:two');
    await gateway.changeListingPool(command('remove'), listing, null);
    await gateway.allocatePool(command('allocate'), pool, 'mall:one', 'channel', '办公渠道池');
    await gateway.changePoolBinding(command('attach'), pool, 'mall:one', true);
    await gateway.changePoolBinding(command('detach'), pool, 'mall:one', false);

    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'PUT /api/v1/catalog/listings/listing%3Aone/publication',
      'DELETE /api/v1/catalog/listings/listing%3Aone/publication',
      'PUT /api/v1/catalog/listings/listing%3Aone/price',
      'PUT /api/v1/catalog/listings/listing%3Aone/pool',
      'PUT /api/v1/catalog/listings/listing%3Aone/pool',
      'POST /api/v1/catalog/pools/pool%3Aone/allocations',
      'PUT /api/v1/catalog/pools/pool%3Aone/bindings/mall%3Aone',
      'DELETE /api/v1/catalog/pools/pool%3Aone/bindings/mall%3Aone',
    ]);
    expect(requests[2]?.body).toEqual({ amountMinor: 9900, currency: 'CNY' });
    expect(requests[3]?.body).toEqual({ pool: 'pool:two' });
    expect(requests[4]?.body).toEqual({ pool: null });
    expect(requests.map(({ headers }) => headers.get('if-match'))).toEqual(['"3"', '"3"', '"4"', '"3"', '"3"', null, '"9"', '"9"']);
    expect(requests.every(({ headers }) => headers.get('idempotency-key') !== null && headers.get('x-csrf-token') === 'csrf:one')).toBe(true);
  });

  it('requires a server preview hash before executing a batch', async () => {
    const gateway = createGateway();
    const preview = await gateway.previewProductBatch(command('preview'), [listing], 'publish');
    const receipt = await gateway.executeProductBatch(command('execute'), [listing], 'publish', preview.previewHash);

    expect(preview).toMatchObject({ phase: 'preview', count: 1, previewHash: 'b'.repeat(64) });
    expect(receipt).toMatchObject({ phase: 'executed', count: 1, failed: 0 });
    expect(requests.map(({ body }) => body)).toEqual([
      { phase: 'preview', action: 'publish', items: [{ id: 'listing:one', expectedVersion: 3 }] },
      { phase: 'execute', action: 'publish', items: [{ id: 'listing:one', expectedVersion: 3 }], previewHash: 'b'.repeat(64) },
    ]);
    expect(requests.map(({ headers }) => headers.get('idempotency-key'))).toEqual(['command:preview', 'command:execute']);
  });
});

function createGateway() {
  return new ProductGateway({ apiBaseUrl: 'http://127.0.0.1:3001', clientVersion: 'test', catalogVersion: 'catalog:test' });
}
function command(kind: string): ProductCommand {
  return { scope: { kind: 'mall', id: 'mall:one' }, accessVersion: 7, identity: `command:${kind}`, csrf: 'csrf:one' };
}

const listing: Listing = listingFixture();
const pool: Pool = { id: 'pool:one', scope_id: 'mall:one', kind: 'private', name: '办公用品池', status: 'active', version: 9, item_count: 1 };
const productRecord = {
  id: 'product:one',
  scope_id: 'mall:one',
  owner_partner_id: null,
  brand_id: null,
  category_id: 'category:office',
  title: '办公福利礼盒',
  product_type: 'physical',
  attributes: {},
  status: 'draft',
  version: 7,
  created_at: '2026-09-07T08:00:00.000Z',
  updated_at: '2026-09-07T08:00:00.000Z',
};
const listingRecord = {
  id: 'listing:one',
  scope_id: 'mall:one',
  pool_id: 'pool:one',
  sku_id: 'sku:one',
  title: '办公福利礼盒',
  status: 'published',
  effective_at: '2026-09-07T08:00:00.000Z',
  expires_at: null,
  version: 4,
  created_at: '2026-09-07T08:00:00.000Z',
  updated_at: '2026-09-07T08:00:00.000Z',
};
const price = { listing_id: 'listing:one', sku_id: 'sku:one', scope_id: 'mall:one', amount_minor: 9900, currency: 'CNY', version: 5, effective_at: '2026-09-07T08:00:00.000Z', updated_at: '2026-09-07T08:00:00.000Z' };
const poolRecord = { id: 'pool:two', scope_id: 'mall:one', kind: 'channel', name: '办公渠道池', status: 'active', version: 1 };
const binding = { mall_id: 'mall:one', pool_id: 'pool:one', listing_kind: 'selected', status: 'active', effective_at: '2026-09-07T08:00:00.000Z', expires_at: null, created_at: '2026-09-07T08:00:00.000Z' };
const category = { id: 'category:office', parent_id: null, parent_name: null, code: 'OFFICE', name: '办公用品', status: 'active', sort_order: 10, product_count: 1 };
