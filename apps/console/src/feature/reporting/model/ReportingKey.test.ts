import { describe, expect, it } from 'vitest';
import { reportMetricKey } from './ReportingKey';
import type { ReportMetric } from './Report';

describe('reportMetricKey', () => {
  it('matches the reporting fact natural identity and distinguishes periods', () => {
    const base: ReportMetric = {
      code: 'sales.amount',
      version: 1,
      scope: 'mall-zhudatuan',
      period: { from: '2026-08-30T00:00:00Z', to: '2026-08-31T00:00:00Z', timezone: 'Asia/Shanghai' },
      dimensions: { mall: 'mall-zhudatuan' },
      value: 100,
      unit: 'minor',
      watermark: '2026-08-31T01:00:00Z',
      projectionVersion: 1,
    };
    const next = { ...base, period: { ...base.period, from: '2026-08-31T00:00:00Z', to: '2026-09-01T00:00:00Z' } };

    expect(reportMetricKey(base)).not.toBe(reportMetricKey(next));
    expect(reportMetricKey(base)).toBe(reportMetricKey({ ...base, value: 200, watermark: '2026-08-31T02:00:00Z', projectionVersion: 2 }));
  });
});
