import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ImportUploadGateway } from '../../../shared/import/ImportUploadGateway';
import type { ProductCommand } from '../public';
import { ProductGateway } from './ProductGateway';

interface RequestLog {
  readonly method: string;
  readonly path: string;
  readonly headers: Headers;
  readonly body: unknown;
}
const requests: RequestLog[] = [];
const server = setupServer(
  http.all('*/api/v1/**', async ({ request }) => {
    const url = new URL(request.url);
    requests.push({ method: request.method, path: url.pathname, headers: request.headers, body: request.body === null ? null : await request.json() });
    if (url.pathname === '/api/v1/catalog/imports') return HttpResponse.json(created);
    if (request.method === 'POST') return HttpResponse.json({ ...ready, state: 'running', confirmationRequired: false, version: 3 });
    return HttpResponse.json(ready);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  requests.length = 0;
});
afterAll(() => server.close());

describe('ProductGateway import workflow', () => {
  it('uploads once, creates the catalog preflight and confirms the exact preview version', async () => {
    const upload = vi.fn(() => Promise.resolve({ objectRef: 'object:one', sha256: 'a'.repeat(64), fileName: 'products.csv', mediaType: 'text/csv' as const, size: 24 }));
    const gateway = new ProductGateway(config, undefined, { upload } as unknown as ImportUploadGateway);
    const file = new File(['title,sku\n礼盒,SKU-1\n'], 'products.csv', { type: 'text/csv' });
    const task = await gateway.createProductImport(command('create'), file);
    await gateway.confirmProductImport(command('confirm'), task);

    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ scope: { kind: 'mall', id: 'mall:one' } }), file, undefined, undefined, 'command:create');
    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual(['POST /api/v1/catalog/imports', 'GET /api/v1/runtime/imports/import%3Aone', 'POST /api/v1/runtime/imports/import%3Aone/confirm']);
    expect(requests[0]?.body).toEqual({ objectRef: 'object:one', sha256: 'a'.repeat(64), fileName: 'products.csv' });
    expect(requests[2]?.body).toEqual({ previewHash: 'b'.repeat(64) });
    expect(requests.map(({ headers }) => headers.get('idempotency-key'))).toEqual(['command:create', null, 'command:confirm']);
    expect(requests[2]?.headers.get('if-match')).toBe('"2"');
  });
});

const config = { apiBaseUrl: 'http://127.0.0.1:3001', clientVersion: 'test', catalogVersion: 'catalog:test' };
function command(kind: string): ProductCommand {
  return { scope: { kind: 'mall', id: 'mall:one' }, accessVersion: 7, identity: `command:${kind}`, csrf: 'csrf:one' };
}
const created = { id: 'import:one', state: 'uploaded', total_count: 0, cursor_value: 0, success_count: 0, failure_count: 0, created_at: '2026-09-07T08:00:00.000Z', updated_at: '2026-09-07T08:00:00.000Z' };
const ready = {
  id: 'import:one',
  type: 'import',
  owner: 'catalog',
  kind: 'product',
  title: '商品导入',
  state: 'ready',
  processed: 0,
  total: 1,
  succeeded: 0,
  failed: 0,
  retryableItems: 0,
  cancellable: true,
  retryable: false,
  version: 2,
  createdAt: '2026-09-07T08:00:00.000Z',
  updatedAt: '2026-09-07T08:01:00.000Z',
  expiresAt: '2026-09-08T08:00:00.000Z',
  fileName: 'products.csv',
  downloadAvailable: false,
  confirmationRequired: true,
  previewHash: 'b'.repeat(64),
  columns: ['sku', 'title'],
  validationErrors: 0,
};
