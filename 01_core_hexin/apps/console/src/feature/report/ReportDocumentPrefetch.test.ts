// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';

const api = vi.hoisted(() => ({ salesRead: vi.fn(), listingsRead: vi.fn() }));
vi.mock('@shop/sdk/reporting', () => ({
  createFetchReportingSalesRead: () => api.salesRead,
  createFetchReportingProductsRead: () => vi.fn(),
  createFetchReportingMallsRead: () => vi.fn(),
  createFetchReportingCategoriesRead: () => vi.fn(),
  createFetchReportingChannelsRead: () => vi.fn(),
  createFetchReportingPowderclassRead: () => vi.fn(),
  createFetchReportingVoucherconsumptionRead: () => vi.fn(),
}));
vi.mock('@shop/sdk/catalog', () => ({ createFetchCatalogListingsRead: () => api.listingsRead }));

import { readReport } from './ReportQuery';
import { readSupplierPerspectives } from '../supply-chain/SupplierPerspectiveQuery';

const response = { items: [], count: 0 };
const context: ConsoleContext = {
  session: {
    actor: 'actor:1', membership: 'membership:1', accessVersion: 7, permissions: [],
    capabilities: ['reporting.sales.read', 'catalog.listings.read'], target: 'console',
    scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
    assurance: { level: 1 }, syncedAt: '2026-09-13T00:00:00Z',
  },
  profile: { display_name: '测试运营', employee_no: null },
  scope: { kind: 'mall', id: 'mall:one' }, scopes: [{ kind: 'mall', id: 'mall:one' }],
};

afterEach(() => {
  delete window.__consoleReportPrefetch;
  delete window.__consoleReportSupplierPrefetch;
  delete window.__consoleAbortDocumentPrefetch;
  api.salesRead.mockReset();
  api.listingsRead.mockReset();
});

describe('report document prefetch', () => {
  it('uses the exact report and supplier perspective pages', async () => {
    window.__consoleReportPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7,
      view: 'sales', period: '30days', value: response,
    });
    window.__consoleReportSupplierPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7, value: response,
    });

    await Promise.all([
      expect(readReport(context, 'sales', '30days', undefined, new AbortController().signal)).resolves.toMatchObject({ count: 0 }),
      expect(readSupplierPerspectives(context, new AbortController().signal)).resolves.toEqual([]),
    ]);
    expect(api.salesRead).not.toHaveBeenCalled();
    expect(api.listingsRead).not.toHaveBeenCalled();
  });

  it('falls back when the period does not match', async () => {
    window.__consoleReportPrefetch = resolvedPrefetch({
      scopeKind: 'mall', scopeId: 'mall:one', accessVersion: 7,
      view: 'sales', period: '7days', value: response,
    });
    api.salesRead.mockResolvedValue(response);

    await readReport(context, 'sales', '30days', undefined, new AbortController().signal);
    expect(api.salesRead).toHaveBeenCalledOnce();
  });

  it('cancels the report document request when navigation aborts', async () => {
    window.__consoleReportPrefetch = { settled: false, promise: new Promise(() => undefined) };
    window.__consoleAbortDocumentPrefetch = vi.fn();
    const controller = new AbortController();

    const reading = readReport(context, 'sales', '30days', undefined, controller.signal);
    controller.abort(new DOMException('navigation cancelled', 'AbortError'));

    await expect(reading).rejects.toMatchObject({ name: 'AbortError' });
    expect(window.__consoleAbortDocumentPrefetch).toHaveBeenCalledOnce();
    expect(api.salesRead).not.toHaveBeenCalled();
  });
});

function resolvedPrefetch<T>(value: T) {
  return { settled: true, promise: Promise.resolve(value) };
}
