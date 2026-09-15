// @vitest-environment jsdom

import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ listingsRead: vi.fn() }));
vi.mock('@shop/sdk/catalog', () => ({ createFetchCatalogListingsRead: () => api.listingsRead }));

import { readProducts, type ProductQuery } from './ProductQuery';

const response = { items: [], count: 0, total_count: 0,
  status_counts: { needs_attention: 0, pending_review: 0, published: 0, unpublished: 0 } };
const prefetchQuery = {
  q: '', category: '', supplier: '', mall: '', status: '', limit: 20, preview: false,
} as const;
const filter: ProductQuery = prefetchQuery;
const context: ConsoleContext = {
  session: {
    actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [],
    capabilities: ['catalog.listings.read'], target: 'console',
    scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
    assurance: { level: 1 }, syncedAt: '2026-09-13T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
};

afterEach(() => {
  delete window.__consoleProductPrefetch;
  delete window.__consoleAbortDocumentPrefetch;
  api.listingsRead.mockReset();
});

describe('product document prefetch', () => {
  it('uses the exact prefetched page without repeating the SDK request', async () => {
    window.__consoleProductPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, query: prefetchQuery, value: response,
    });

    await expect(readProducts(context, filter, new AbortController().signal)).resolves.toMatchObject({ count: 0 });
    expect(api.listingsRead).not.toHaveBeenCalled();
  });

  it('falls back when the prefetched filter does not match', async () => {
    window.__consoleProductPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7,
      query: { ...prefetchQuery, limit: 50 }, value: response,
    });
    api.listingsRead.mockResolvedValue(response);

    await readProducts(context, filter, new AbortController().signal);
    expect(api.listingsRead).toHaveBeenCalledOnce();
  });

  it('bounds an omitted catalog page size to the lightweight first page', async () => {
    api.listingsRead.mockResolvedValue(response);

    await readProducts(context, { q: '', category: '', preview: false }, new AbortController().signal);

    expect(api.listingsRead).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ limit: 20 }) }),
      expect.anything(),
    );
  });

  it('uses an exact prefetched supply network read', async () => {
    const supplyFilter: ProductQuery = {
      q: '', category: '', status: '', limit: 1, preview: true, view: 'supply-network',
    };
    window.__consoleProductPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7,
      query: {
        q: '', category: '', supplier: '', mall: '', status: '', limit: 1,
        preview: true, view: 'supply-network' as const,
      },
      value: response,
    });

    await expect(readProducts(context, supplyFilter, new AbortController().signal)).resolves.toMatchObject({ count: 0 });
    expect(api.listingsRead).not.toHaveBeenCalled();
  });

  it('aborts the in-flight document handoff with route navigation', async () => {
    window.__consoleProductPrefetch = { settled: false, promise: new Promise(() => undefined) };
    window.__consoleAbortDocumentPrefetch = vi.fn();
    const controller = new AbortController();

    const reading = readProducts(context, filter, controller.signal);
    controller.abort(new DOMException('navigation cancelled', 'AbortError'));

    await expect(reading).rejects.toMatchObject({ name: 'AbortError' });
    expect(window.__consoleAbortDocumentPrefetch).toHaveBeenCalledOnce();
    expect(api.listingsRead).not.toHaveBeenCalled();
  });
});

function resolvedPrefetch<T>(value: T) {
  return { settled: true, promise: Promise.resolve(value) };
}
