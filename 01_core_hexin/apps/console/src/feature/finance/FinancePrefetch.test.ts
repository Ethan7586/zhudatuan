import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';

const api = vi.hoisted(() => ({
  readFinance: vi.fn().mockResolvedValue({ items: [] }),
  readFinanceReconciliations: vi.fn().mockResolvedValue({ items: [], count: 0, facets: {} }),
}));
vi.mock('./FinanceQuery', async (importOriginal) => ({
  ...await importOriginal<typeof import('./FinanceQuery')>(), readFinance: api.readFinance,
}));
vi.mock('./FinanceWorkspaceQuery', async (importOriginal) => ({
  ...await importOriginal<typeof import('./FinanceWorkspaceQuery')>(), readFinanceReconciliations: api.readFinanceReconciliations,
}));

import { prefetchFinance } from './FinancePrefetch';

describe('finance page prefetch', () => {
  it('prepares overview and reconciliation data once', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await Promise.all([prefetchFinance(client, context), prefetchFinance(client, context)]);
    expect(api.readFinance).toHaveBeenCalledOnce();
    expect(api.readFinanceReconciliations).toHaveBeenCalledOnce();
  });
});

const context = consoleContext(['finance.overview.read', 'finance.reconciliations.read']);

function consoleContext(capabilities: string[]): ConsoleContext {
  return {
    session: { actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [], capabilities,
      target: 'console', scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
      assurance: { level: 1 }, syncedAt: '2026-09-13T00:00:00Z' },
    profile: { display_name: '测试运营', employee_no: null },
    scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
  };
}
