import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';

const api = vi.hoisted(() => ({ readApplications: vi.fn().mockResolvedValue({ items: [], count: 0 }) }));
vi.mock('./ApplicationQuery', async (importOriginal) => ({
  ...await importOriginal<typeof import('./ApplicationQuery')>(),
  readApplications: api.readApplications,
}));

import { prefetchApplications } from './ApplicationPrefetch';

describe('application page prefetch', () => {
  it('deduplicates the first application page', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await Promise.all([prefetchApplications(client, context), prefetchApplications(client, context)]);
    expect(api.readApplications).toHaveBeenCalledOnce();
  });
});

const context = consoleContext(['experience.applications.read']);

function consoleContext(capabilities: string[]): ConsoleContext {
  return {
    session: { actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [], capabilities,
      target: 'console', scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
      assurance: { level: 1 }, syncedAt: '2026-09-13T00:00:00Z' },
    profile: { display_name: '测试运营', employee_no: null },
    scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
  };
}
