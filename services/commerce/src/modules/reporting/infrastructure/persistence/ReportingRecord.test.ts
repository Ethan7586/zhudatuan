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
      definition: { name: '成交金额', formula: '支付金额合计', dimensions: ['mall'], granularity: 'day', owner: 'reporting' },
      scope: 'enterprise:1',
      period: { from: '2026-08-31 00:00:00+00', to: '2026-09-01 00:00:00+00', timezone: 'Asia/Shanghai' },
      dimensions: {},
      value: 10,
      unit: 'minor',
      currency: 'CNY',
      watermark: '2026-08-31T04:21:09.857981+00:00',
      projectionVersion: 1,
      cursorTime: '2026-09-01T00:00:00+00:00',
      cursorId: 'sales.amount:1',
    });

    expect(row.period.from).toBe('2026-08-31T00:00:00.000Z');
    expect(Object.isFrozen(row.definition.dimensions)).toBe(true);
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
        topProducts: [{ productId: 'product:1', name: '办公套装', salesCents: 12800, quantity: 2, orderCount: 1 }],
        malls: [],
        events: [{ id: 'event:1', kind: 'calendar', title: '订单支付', metric: '¥10.00', time: '2026-08-31T04:21:09.857981+00:00', date: '2026-08-31' }],
        insights: [],
      },
    };
    const normalized = cockpitSummary(summary);
    expect(normalized.sales.asOf).toBe('2026-08-31T04:21:09.857Z');
    expect(normalized.sales.period.from).toBe('2026-08-01T00:00:00.000Z');
    expect(normalized.sales.topProducts).toEqual([{ productId: 'product:1', name: '办公套装', salesCents: 12800, quantity: 2, orderCount: 1 }]);
    expect(normalized.sales.events[0]?.time).toBe('2026-08-31T04:21:09.857Z');
    expect(
      exportJob({
        id: 'export:1',
        scope: 'enterprise:1',
        report: 'metrics',
        filter: {},
        snapshot: { filter: {}, watermark: { event: 'event:one', occurredAt: '2026-08-31T04:21:09+00:00', version: 1 }, generatedAt: '2026-08-31T04:21:09+00:00', generationVersion: 1 },
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

  it('fails closed when a persisted metric contains a non-IANA timezone', () => {
    expect(() => metricRow({
      code: 'sales.amount', version: 1,
      definition: { name: '成交金额', formula: '支付金额合计', dimensions: ['mall'], granularity: 'day', owner: 'reporting' },
      scope: 'enterprise:1', period: { from: '2026-08-31T00:00:00Z', to: '2026-09-01T00:00:00Z', timezone: 'UTC+8' },
      dimensions: { mall: 'mall:one' }, value: 10, unit: 'minor', currency: 'CNY', watermark: '2026-09-01T00:00:00Z',
      projectionVersion: 1, cursorTime: '2026-09-01T00:00:00Z', cursorId: 'sales.amount:one',
    })).toThrow('REPORT_TIMEZONE_INVALID');
  });
});
