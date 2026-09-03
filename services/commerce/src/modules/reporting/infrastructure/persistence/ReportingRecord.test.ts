import { describe, expect, it } from 'vitest';
import type { CockpitSummary } from '../../domain/model/Metric';
import { cockpitSummary, exportJob, metricRow, utcTime } from './ReportingRecord';

describe('reporting persistence records', () => {
  it('normalizes database offsets and microseconds to the public UTC format', () => {
    expect(utcTime('2026-08-31T04:21:09.857981+00:00')).toBe('2026-08-31T04:21:09.857Z');
    expect(utcTime(new Date('2026-08-31T04:21:09Z'))).toBe('2026-08-31T04:21:09.000Z');
  });

  it('normalizes every metric time at the persistence boundary', () => {
    const row = metricRow({
      code: 'sales.amount',
      version: 1,
      scope: 'enterprise:1',
      period: { from: '2026-08-31 00:00:00+00', to: '2026-09-01 00:00:00+00', timezone: 'Asia/Shanghai' },
      dimensions: {},
      value: 10,
      unit: 'minor',
      watermark: '2026-08-31T04:21:09.857981+00:00',
      projectionVersion: 1,
      cursorTime: '2026-09-01T00:00:00+00:00',
      cursorId: 'sales.amount:1',
    });

    expect(row.period.from).toBe('2026-08-31T00:00:00.000Z');
    expect(row.period.to).toBe('2026-09-01T00:00:00.000Z');
    expect(row.watermark).toBe('2026-08-31T04:21:09.857Z');
    expect(row.cursorTime).toBe('2026-09-01T00:00:00.000Z');
  });

  it('normalizes cockpit and export timestamps through the same policy', () => {
    const summary: CockpitSummary = {
      catalogCount: 0,
      availableStock: 0,
      orderCount: 0,
      afterSaleCount: 0,
      sales: {
        asOf: '2026-08-31T04:21:09.857981+00:00',
        cumulativeSalesCents: 0,
        paidOrderCount: 0,
        averageOrderValueCents: 0,
        periodSalesCents: 0,
        periodPaidOrderCount: 0,
        refundedCents: 0,
        activeProductCount: 0,
        soldProductCount: 0,
        unsoldActiveProductCount: 0,
        period: { from: '2026-08-01T00:00:00+00:00', to: '2026-09-01T00:00:00+00:00' },
        conclusion: '经营稳定',
        deltas: { netSalesRatio: null, paidOrdersRatio: null, averageOrderRatio: null, refundRate: 0, refundRateDeltaPoints: null },
        trend: [],
        weeklyTrend: [],
        categories: [],
        topProducts: [],
        malls: [],
        events: [{ id: 'event:1', kind: 'calendar', title: '订单支付', metric: '¥10.00', time: '2026-08-31T04:21:09.857981+00:00', date: '2026-08-31' }],
        insights: [],
      },
    };
    const normalized = cockpitSummary(summary);
    expect(normalized.sales.asOf).toBe('2026-08-31T04:21:09.857Z');
    expect(normalized.sales.period.from).toBe('2026-08-01T00:00:00.000Z');
    expect(normalized.sales.events[0]?.time).toBe('2026-08-31T04:21:09.857Z');
    expect(
      exportJob({
        id: 'export:1',
        scope: 'enterprise:1',
        report: 'metrics',
        filter: {},
        state: 'completed',
        cursor: null,
        recordCount: 0,
        objectReference: null,
        objectHash: null,
        objectSize: null,
        scanState: 'clean',
        expiresAt: '2026-09-01T04:21:09+00:00',
        createdAt: '2026-08-31T04:21:09+00:00',
        generatedAt: null,
      })
    ).toMatchObject({ expiresAt: '2026-09-01T04:21:09.000Z', createdAt: '2026-08-31T04:21:09.000Z', generatedAt: null });
  });

  it('fails closed for an invalid database timestamp', () => {
    expect(() => utcTime('not-a-time')).toThrow('REPORT_TIME_INVALID');
  });
});
