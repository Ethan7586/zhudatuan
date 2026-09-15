// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';

const api = vi.hoisted(() => ({ casesRead: vi.fn(), historyRead: vi.fn(), messagesRead: vi.fn() }));
vi.mock('@shop/sdk/support', () => ({
  createFetchSupportCasesRead: () => api.casesRead,
  createFetchSupportHistoryRead: () => api.historyRead,
  createFetchSupportMessagesRead: () => api.messagesRead,
}));

import { readCases, readHistory } from './SupportQuery';

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
const response = { items: [], count: 0 };

afterEach(() => {
  delete window.__consoleSupportPrefetch;
  delete window.__consoleAbortDocumentPrefetch;
  api.casesRead.mockReset();
  api.historyRead.mockReset();
});

describe('support document prefetch', () => {
  it('uses the exact prefetched case page without repeating the SDK request', async () => {
    window.__consoleSupportPrefetch = { settled: true, promise: Promise.resolve({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, value: response,
    }) };

    await expect(readCases(context, 'handling', undefined, new AbortController().signal)).resolves.toMatchObject({ count: 0 });
    expect(api.casesRead).not.toHaveBeenCalled();
  });

  it('falls back when the prefetched scope does not match', async () => {
    window.__consoleSupportPrefetch = { settled: true, promise: Promise.resolve({
      scopeKind: 'mall', scopeId: 'mall:other', accessVersion: 7, value: response,
    }) };
    api.casesRead.mockResolvedValue(response);

    await readCases(context, 'handling', undefined, new AbortController().signal);
    expect(api.casesRead).toHaveBeenCalledOnce();
  });

  it('does not reuse the handling prefetch for another queue', async () => {
    window.__consoleSupportPrefetch = { settled: true, promise: Promise.resolve({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, value: response,
    }) };
    api.casesRead.mockResolvedValue(response);

    await readCases(context, 'created', undefined, new AbortController().signal);

    expect(api.casesRead).toHaveBeenCalledWith(expect.objectContaining({ query: { limit: 50, view: 'created' } }), expect.anything());
  });

  it('reads the scoped audit history for one exact case', async () => {
    api.historyRead.mockResolvedValue({ items: [{ sequence: 1, kind: 'priority.reviewed', actor_id: 'actor:1',
      evidence: { priority: 'high' }, occurred_at: '2026-09-16T00:00:00Z' }], count: 1 });

    const value = await readHistory(context, 'case:one', new AbortController().signal);

    expect(value.items[0]).toMatchObject({ sequence: 1, kind: 'priority.reviewed' });
    expect(api.historyRead).toHaveBeenCalledWith(expect.objectContaining({ path: { caseid: 'case:one' }, query: { limit: 100 } }), expect.anything());
  });
});
