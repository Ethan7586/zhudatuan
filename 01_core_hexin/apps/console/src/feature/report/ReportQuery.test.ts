import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ salesRead: vi.fn() }));
vi.mock('@shop/sdk/reporting', () => ({
  createFetchReportingSalesRead: () => api.salesRead,
  createFetchReportingProductsRead: () => vi.fn(),
  createFetchReportingMallsRead: () => vi.fn(),
  createFetchReportingCategoriesRead: () => vi.fn(),
  createFetchReportingChannelsRead: () => vi.fn(),
  createFetchReportingPowderclassRead: () => vi.fn(),
  createFetchReportingVoucherconsumptionRead: () => vi.fn(),
}));

import { readReport } from './ReportQuery';

const context = {
  session: { accessVersion: 1 },
  scope: { kind: 'mall', id: 'mall:1' },
} as ConsoleContext;

describe('supplier report perspective', () => {
  it('routes settlement analysis through the authorized reporting read with a supplier section', async () => {
    api.salesRead.mockResolvedValue({ items: [], count: 0 });

    await readReport(context, 'settlements', '30days', undefined, new AbortController().signal, 'partner:supplier:1');

    expect(api.salesRead).toHaveBeenCalledWith(
      { query: { limit: 50, period: '30days', supplierid: 'partner:supplier:1', suppliersection: 'settlement' } },
      expect.objectContaining({ scope: { kind: 'mall', id: 'mall:1' } }),
    );
  });
});
