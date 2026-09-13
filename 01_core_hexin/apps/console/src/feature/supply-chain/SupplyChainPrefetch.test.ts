// @vitest-environment node

import { QueryClient } from '@tanstack/react-query';
import { HttpResponse, delay, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { productKey } from '../product/ProductQuery';
import { prefetchSupplyChain, supplyChainQuery } from './SupplyChainPrefetch';

const response = { items: [], count: 0, total_count: 0,
  status_counts: { needs_attention: 0, pending_review: 0, published: 0, unpublished: 0 } };
let requests = 0;
const server = setupServer(http.get('*/api/v1/catalog/listings', async ({ request }) => {
  requests += 1;
  expect(new URL(request.url).searchParams.get('view')).toBe('supply-network');
  await delay(20);
  return HttpResponse.json(response);
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { requests = 0; server.resetHandlers(); });
afterAll(() => server.close());

describe('supply chain page prefetch', () => {
  it('deduplicates the supply network read and keeps it ready for navigation', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await Promise.all([prefetchSupplyChain(client, context), prefetchSupplyChain(client, context)]);

    expect(requests).toBe(1);
    expect(client.getQueryData(productKey(context, supplyChainQuery))).toEqual(response);
    expect(prefetchSupplyChain(client, context)).toBeUndefined();
  });

  it('does not request the supply network without the read capability', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    expect(prefetchSupplyChain(client, {
      ...context, session: { ...context.session, capabilities: [] },
    })).toBeUndefined();
    expect(requests).toBe(0);
  });
});

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
