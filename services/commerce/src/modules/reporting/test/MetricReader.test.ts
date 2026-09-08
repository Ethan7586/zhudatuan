import { describe, expect, it, vi } from 'vitest';
import { MetricReader } from '../application/service/MetricReader';
import type { CockpitSummary, MetricRow } from '../domain/model/Metric';

const watermark = { event: 'event:watermark', occurredAt: '2026-09-05T12:00:00.000Z', version: 7 } as const;

describe('report metric reader policy', () => {
  it('authorizes before reading and never trusts a caller supplied scope', async () => {
    const reports = { watermark: vi.fn(), metrics: vi.fn(), cockpit: vi.fn() };
    const reader = new MetricReader(reports as never);

    await expect(
      reader.read(
        'reporting.sales.read',
        { query: { limit: 20 } } as never,
        {
          operation: 'reporting.sales.read',
          transaction: {},
          security: { kind: 'anonymous', channel: 'public', target: 'console', trace: 'trace:one' },
        } as never,
        'sales'
      )
    ).rejects.toThrow('AUTHENTICATION_REQUIRED');
    expect(reports.watermark).not.toHaveBeenCalled();
    expect(reports.metrics).not.toHaveBeenCalled();
  });

  it('returns governed values, preserves null comparisons and uses the frozen watermark as the summary time', async () => {
    const reports = {
      watermark: vi.fn().mockResolvedValue(watermark),
      metrics: vi.fn().mockResolvedValue([metric({ value: 100.6 })]),
      cockpit: vi.fn().mockResolvedValue(summary()),
    };
    const reader = new MetricReader(reports as never);
    const result = await reader.read('reporting.dashboard.read', { query: { limit: 20, period: '30days' } } as never, session('reporting.dashboard.read'), null);
    const body = result.body as unknown as { items: readonly MetricRow[]; summary: CockpitSummary };

    expect(reports.metrics).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ scope: 'mall:one', watermarkAt: watermark.occurredAt, watermarkVersion: 7 }));
    expect(reports.cockpit).toHaveBeenCalledWith(expect.anything(), {
      scope: 'mall:one',
      period: '30days',
      application: null,
      watermarkAt: watermark.occurredAt,
      watermarkVersion: 7,
      snapshotAt: expect.any(String),
    });
    expect(body.items[0]?.value).toBe(101);
    expect(body.summary).toMatchObject({ availableStock: -1, sales: { asOf: watermark.occurredAt, averageOrderValueCents: 51 } });
    expect(body.summary.sales.deltas).toMatchObject({ netSalesRatio: null, refundRateDeltaPoints: null });
  });

  it('fails closed on an invalid source timezone or cross-scope projection row', async () => {
    const reports = { watermark: vi.fn().mockResolvedValue(watermark), metrics: vi.fn(), cockpit: vi.fn() };
    const reader = new MetricReader(reports as never);
    reports.metrics.mockResolvedValueOnce([metric({ period: { from: '2026-09-04T16:00:00.000Z', to: '2026-09-05T16:00:00.000Z', timezone: 'Mars/Base' } })]);
    await expect(reader.read('reporting.sales.read', { query: { limit: 20 } } as never, session('reporting.sales.read'), 'sales')).rejects.toThrow('REPORT_TIMEZONE_INVALID');

    reports.metrics.mockResolvedValueOnce([metric({ scope: 'mall:other' })]);
    await expect(reader.read('reporting.sales.read', { query: { limit: 20 } } as never, session('reporting.sales.read'), 'sales')).rejects.toThrow('REPORT_METRIC_RESULT_INVALID');
  });
});

function session(operation: 'reporting.dashboard.read' | 'reporting.sales.read') {
  return {
    operation,
    transaction: {},
    security: { kind: 'session', access: { scope: { id: 'mall:one' } } },
  } as never;
}

function metric(overrides: Partial<MetricRow> = {}): MetricRow {
  return {
    code: 'sales.amount',
    version: 1,
    definition: { name: '成交金额', formula: '支付金额合计', dimensions: ['mall'], granularity: 'day', owner: 'reporting' },
    scope: 'mall:one',
    period: { from: '2026-09-04T16:00:00.000Z', to: '2026-09-05T16:00:00.000Z', timezone: 'Asia/Shanghai' },
    dimensions: { mall: 'mall:one' },
    value: 100,
    unit: 'minor',
    currency: 'CNY',
    watermark: watermark.occurredAt,
    projectionVersion: 2,
    cursorTime: '2026-09-05T16:00:00.000Z',
    cursorId: 'sales.amount:row',
    ...overrides,
  };
}

function summary(): CockpitSummary {
  return {
    catalogCount: 2.2,
    availableStock: -1.4,
    orderCount: 1.2,
    afterSaleCount: 0,
    sales: {
      asOf: '2026-09-06T12:00:00.000Z',
      cumulativeSalesCents: 100.4,
      paidOrderCount: 2.2,
      averageOrderValueCents: 50.6,
      periodSalesCents: 100.4,
      periodPaidOrderCount: 2.2,
      refundedCents: 0,
      activeProductCount: 2.2,
      soldProductCount: 1.2,
      unsoldActiveProductCount: 1.2,
      period: { from: '2026-08-07T00:00:00.000Z', to: '2026-09-06T00:00:00.000Z' },
      conclusion: '经营稳定',
      deltas: { netSalesRatio: null, paidOrdersRatio: 0.1, averageOrderRatio: -0.2, refundRate: 0, refundRateDeltaPoints: null },
      trend: [{ date: '2026-09-05', salesCents: 100.4, orderCount: 2.2 }],
      weeklyTrend: [],
      categories: [{ name: '办公', salesCents: 100.4, share: 1 }],
      topProducts: [{ productId: 'product:one', name: '办公套装', salesCents: 100.4, quantity: 2.2, orderCount: 1.2 }],
      malls: [{ id: 'mall:one', name: '总部商城', salesCents: 100.4, paidOrderCount: 2.2, refundRate: 0 }],
      events: [],
      insights: [],
    },
  };
}
