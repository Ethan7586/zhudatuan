import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';

const api = vi.hoisted(() => ({ readCases: vi.fn() }));
vi.mock('./SupportQuery', async (importOriginal) => ({
  ...await importOriginal<typeof import('./SupportQuery')>(),
  readCases: api.readCases,
}));

import { prefetchSupport } from './SupportPrefetch';

const context: ConsoleContext = {
  session: {
    actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [],
    capabilities: ['support.cases.read'], target: 'console',
    scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
    assurance: { level: 1 }, syncedAt: '2026-09-13T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
};

afterEach(() => api.readCases.mockReset());

describe('support page prefetch', () => {
  it('deduplicates the first case-page read', async () => {
    api.readCases.mockResolvedValue({ items: [], count: 0 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await Promise.all([prefetchSupport(client, context), prefetchSupport(client, context)]);

    expect(api.readCases).toHaveBeenCalledOnce();
  });

  it('does not prefetch without the case-read capability', () => {
    const client = new QueryClient();
    expect(prefetchSupport(client, {
      ...context,
      session: { ...context.session, capabilities: [] },
    })).toBeUndefined();
  });

  it('does not repeatedly retry a failed background prefetch', async () => {
    api.readCases.mockRejectedValue(new Error('offline'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await prefetchSupport(client, context);

    expect(prefetchSupport(client, context)).toBeUndefined();
    expect(api.readCases).toHaveBeenCalledOnce();
  });
});
