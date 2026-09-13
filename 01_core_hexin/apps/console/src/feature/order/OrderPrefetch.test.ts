import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';

const api = vi.hoisted(() => ({ readOrders: vi.fn().mockResolvedValue({ items: [], count: 0, exports: [] }) }));
vi.mock('./OrderQuery', async (importOriginal) => ({
  ...await importOriginal<typeof import('./OrderQuery')>(),
  readOrders: api.readOrders,
}));

import { prefetchOrders } from './OrderPrefetch';

describe('order page prefetch', () => {
  it('deduplicates the default order list', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await Promise.all([prefetchOrders(client, context), prefetchOrders(client, context)]);
    expect(api.readOrders).toHaveBeenCalledOnce();
  });
});

const context = consoleContext(['order.orders.read']);

function consoleContext(capabilities: string[]): ConsoleContext {
  return {
    session: { actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [], capabilities,
      target: 'console', scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
      assurance: { level: 1 }, syncedAt: '2026-09-13T00:00:00Z' },
    profile: { display_name: '测试运营', employee_no: null },
    scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
  };
}
