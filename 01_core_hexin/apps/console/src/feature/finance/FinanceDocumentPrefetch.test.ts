// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import type { FinanceReconciliationQuery } from './FinanceWorkspaceQuery';

const api = vi.hoisted(() => ({ overviewRead: vi.fn(), reconciliationsRead: vi.fn() }));
vi.mock('@shop/sdk/finance', () => ({
  createFetchFinanceOverviewRead: () => api.overviewRead,
  createFetchFinanceReconciliationsRead: () => api.reconciliationsRead,
}));

import { readFinance } from './FinanceQuery';
import { readFinanceReconciliations } from './FinanceWorkspaceQuery';

const overview = { items: [] };
const reconciliations = { items: [], count: 0 };
const filter: FinanceReconciliationQuery = {
  q: '', period: '', channel: '', mall: '', status: '', difference: '', limit: 50,
};
const context: ConsoleContext = {
  session: {
    actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [],
    capabilities: ['finance.overview.read', 'finance.reconciliations.read'], target: 'console',
    scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
    assurance: { level: 1 }, syncedAt: '2026-09-13T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
};

afterEach(() => {
  delete window.__consoleFinanceOverviewPrefetch;
  delete window.__consoleFinanceReconciliationPrefetch;
  delete window.__consoleAbortDocumentPrefetch;
  api.overviewRead.mockReset();
  api.reconciliationsRead.mockReset();
});

describe('finance document prefetch', () => {
  it('uses the exact prefetched overview and reconciliation pages', async () => {
    window.__consoleFinanceOverviewPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, value: overview,
    });
    window.__consoleFinanceReconciliationPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, query: filter, value: reconciliations,
    });

    await Promise.all([
      expect(readFinance(context, new AbortController().signal)).resolves.toEqual(overview),
      expect(readFinanceReconciliations(context, filter, new AbortController().signal)).resolves.toMatchObject({ count: 0 }),
    ]);
    expect(api.overviewRead).not.toHaveBeenCalled();
    expect(api.reconciliationsRead).not.toHaveBeenCalled();
  });

  it('falls back independently when scope or query does not match', async () => {
    window.__consoleFinanceOverviewPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:other', accessVersion: 7, value: overview,
    });
    window.__consoleFinanceReconciliationPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7,
      query: { ...filter, limit: 20 }, value: reconciliations,
    });
    api.overviewRead.mockResolvedValue(overview);
    api.reconciliationsRead.mockResolvedValue(reconciliations);

    await Promise.all([
      readFinance(context, new AbortController().signal),
      readFinanceReconciliations(context, filter, new AbortController().signal),
    ]);
    expect(api.overviewRead).toHaveBeenCalledOnce();
    expect(api.reconciliationsRead).toHaveBeenCalledOnce();
  });
});

function resolvedPrefetch<T>(value: T) {
  return { settled: true, promise: Promise.resolve(value) };
}
