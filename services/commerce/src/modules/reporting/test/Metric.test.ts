import { describe, expect, it } from 'vitest';
import { projectedMetric } from '../domain/model/Projection';

describe('reporting metric contribution', () => {
  it('keeps event timezone and source currency instead of inventing a platform default', () => {
    const metric = projectedMetric(
      'sales.amount',
      'mall:one',
      {
        from: '2026-09-05T04:00:00.000Z',
        to: '2026-09-06T04:00:00.000Z',
        timezone: 'America/New_York',
      },
      { mall: 'mall:one', application: 'application:one' },
      1299,
      'minor',
      'USD',
      '2026-09-05T12:00:00.000Z'
    );

    expect(metric).toMatchObject({ code: 'sales.amount', currency: 'USD', unit: 'minor', period: { timezone: 'America/New_York' } });
    expect(Object.isFrozen(metric.dimensions)).toBe(true);
  });

  it('rejects invalid timezones and amount metrics without currency', () => {
    expect(() =>
      projectedMetric(
        'sales.amount',
        'mall:one',
        {
          from: '2026-09-05T00:00:00Z',
          to: '2026-09-06T00:00:00Z',
          timezone: 'Mars/Base',
        },
        { mall: 'mall:one' },
        100,
        'minor',
        'CNY',
        '2026-09-05T01:00:00Z'
      )
    ).toThrow('REPORT_METRIC_INVALID');
    expect(() =>
      projectedMetric(
        'sales.amount',
        'mall:one',
        {
          from: '2026-09-05T00:00:00Z',
          to: '2026-09-06T00:00:00Z',
          timezone: 'Asia/Shanghai',
        },
        { mall: 'mall:one' },
        100,
        'minor',
        null,
        '2026-09-05T01:00:00Z'
      )
    ).toThrow('REPORT_METRIC_INVALID');
  });
});
