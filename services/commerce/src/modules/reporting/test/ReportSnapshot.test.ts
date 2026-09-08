import { describe, expect, it, vi } from 'vitest';
import { MetricReader } from '../application/service/MetricReader';
import { ReportSnapshot } from '../domain/model/ReportSnapshot';

const query = { scope: 'mall:one', dimension: 'sales', period: '30days', application: null } as const;
const watermark = { event: 'event:watermark', occurredAt: '2026-09-05T12:00:00.000Z', version: 7 } as const;

describe('report snapshot', () => {
  it('binds a canonical cursor to scope, conditions, event watermark and generation version', () => {
    const snapshot = new ReportSnapshot(query, watermark, '2026-09-05T12:00:01.000Z');
    const cursor = snapshot.cursor('2026-09-05T00:00:00.000Z', 'sales.amount:row');
    const resumed = ReportSnapshot.resume(cursor, query);

    expect(resumed).toMatchObject({ sort: '2026-09-05T00:00:00.000Z', row: 'sales.amount:row' });
    expect(resumed.snapshot.toJSON()).toEqual(snapshot.toJSON());
    expect(() => ReportSnapshot.resume(cursor, { ...query, scope: 'mall:two' })).toThrow('REPORT_CURSOR_INVALID');
  });

  it('restores only an exact server-shaped snapshot for the expected governed query', () => {
    const original = new ReportSnapshot(query, watermark, '2026-09-05T12:00:01.000Z').toJSON();
    expect(ReportSnapshot.restore(original, query).toJSON()).toEqual(original);
    expect(() => ReportSnapshot.restore({ ...original, query: { ...original.query, period: '7days' } }, query)).toThrow('REPORT_SNAPSHOT_INVALID');
    expect(() => ReportSnapshot.restore({ ...original, secret: 'unexpected' }, query)).toThrow('REPORT_SNAPSHOT_INVALID');
    expect(() => ReportSnapshot.restore({ ...original, watermark: { ...original.watermark, extra: 1 } }, query)).toThrow('REPORT_SNAPSHOT_INVALID');
  });

  it('keeps later pages on the first page watermark', async () => {
    const metric = {
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
    } as const;
    const metrics = vi
      .fn()
      .mockResolvedValueOnce([metric, { ...metric, cursorId: 'sales.amount:next' }])
      .mockResolvedValueOnce([]);
    const waterline = vi.fn().mockResolvedValue(watermark);
    const reader = new MetricReader({ metrics, watermark: waterline, cockpit: vi.fn() } as never);
    const context = { operation: 'reporting.sales.read', transaction: {}, security: { kind: 'session', access: { scope: { id: 'mall:one' } } } } as never;

    const first = await reader.read('reporting.sales.read', { query: { limit: 1, period: '30days' } } as never, context, 'sales');
    const firstBody = first.body as any;
    const second = await reader.read('reporting.sales.read', { query: { limit: 1, period: '30days', cursor: firstBody.nextCursor } } as never, context, 'sales');

    expect(waterline).toHaveBeenCalledOnce();
    expect(metrics.mock.calls[1]?.[1]).toMatchObject({ watermarkAt: watermark.occurredAt, cursorId: 'sales.amount:row' });
    expect((second.body as any).snapshot.watermark).toEqual(watermark);
  });
});
