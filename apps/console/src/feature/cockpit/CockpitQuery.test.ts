// @vitest-environment jsdom

import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ dashboardRead: vi.fn() }));
vi.mock('@shop/sdk/reporting', () => ({ createFetchReportingDashboardRead: () => api.dashboardRead }));

import { readCockpit } from './CockpitQuery';

const context: ConsoleContext = {
  session: {
    actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [], capabilities: [], target: 'console',
    scope: { kind: 'enterprise', id: 'enterprise:1' }, scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
    assurance: { level: 1 }, syncedAt: '2026-08-26T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'enterprise', id: 'enterprise:1' },
  scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
};

const response = {
  items: [], count: 0,
  summary: {
    catalogCount: 0, availableStock: 0, orderCount: 0, afterSaleCount: 0,
    sales: {
      asOf: '2026-08-26T00:00:00Z', cumulativeSalesCents: 0, paidOrderCount: 0, averageOrderValueCents: 0,
      periodSalesCents: 0, periodPaidOrderCount: 0, refundedCents: 0, activeProductCount: 0,
      soldProductCount: 0, unsoldActiveProductCount: 0, trend: [], categories: [], topProducts: [],
    },
  },
};

afterEach(() => {
  delete window.__consoleCockpitPrefetch;
  delete window.__consoleAbortDocumentPrefetch;
  api.dashboardRead.mockReset();
});

describe('cockpit document prefetch', () => {
  it('consumes an exact scope and access-version match without repeating the SDK read', async () => {
    window.__consoleCockpitPrefetch = resolvedPrefetch({
      scopeKind: 'enterprise', scopeId: 'enterprise:1', accessVersion: 7, period: '30days', value: response,
    });

    await expect(readCockpit(context, '30days', new AbortController().signal)).resolves.toMatchObject({ count: 0 });
    expect(api.dashboardRead).not.toHaveBeenCalled();
  });

  it('falls back to the authorized SDK read when the prefetched scope does not match', async () => {
    window.__consoleCockpitPrefetch = resolvedPrefetch({
      scopeKind: 'enterprise', scopeId: 'enterprise:other', accessVersion: 7, period: '30days', value: response,
    });
    api.dashboardRead.mockResolvedValue(response);

    await expect(readCockpit(context, '30days', new AbortController().signal)).resolves.toMatchObject({ count: 0 });
    expect(api.dashboardRead).toHaveBeenCalledOnce();
    expect(api.dashboardRead.mock.calls[0]?.[1]).toMatchObject({
      accessVersion: 7,
      scope: { kind: 'enterprise', id: 'enterprise:1' },
    });
  });

  it('abandons a pending document read before using the SDK fallback', async () => {
    window.__consoleCockpitPrefetch = { settled: false, promise: new Promise(() => undefined) };
    window.__consoleAbortDocumentPrefetch = vi.fn();
    api.dashboardRead.mockResolvedValue(response);

    await expect(readCockpit(context, '30days', new AbortController().signal)).resolves.toMatchObject({ count: 0 });
    expect(window.__consoleAbortDocumentPrefetch).toHaveBeenCalledOnce();
    expect(api.dashboardRead).toHaveBeenCalledOnce();
  });

  it('falls back to the SDK when the prefetched dashboard schema is invalid', async () => {
    window.__consoleCockpitPrefetch = resolvedPrefetch({
      scopeKind: 'enterprise', scopeId: 'enterprise:1', accessVersion: 7, period: '30days', value: { count: 'invalid' },
    });
    api.dashboardRead.mockResolvedValue(response);

    await expect(readCockpit(context, '30days', new AbortController().signal)).resolves.toMatchObject({ count: 0 });
    expect(api.dashboardRead).toHaveBeenCalledOnce();
  });
});

function resolvedPrefetch<T>(value: T) {
  return { settled: true, promise: Promise.resolve(value) };
}
