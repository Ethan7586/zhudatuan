import { describe, expect, it } from 'vitest';
import { ServiceLevel } from './ServiceLevel';

describe('ServiceLevel', () => {
  it('evaluates a ratio without rounding across an SLO boundary', () => {
    const level = new ServiceLevel({ id: 'availability', title: '可用率', indicator: { metric: 'commerce.operation.count', type: 'ratio', goodResult: 'success' }, target: 99.95, unit: 'percent', direction: 'minimum', windowSeconds: 300, severity: 'critical', owner: 'reliability', runbook: 'docs/operations/deployment.md' });
    expect(level.evaluate([{ name: 'commerce.operation.count', value: 999, result: 'success' }, { name: 'commerce.operation.count', value: 1, result: 'failure' }])).toMatchObject({ current: 99.9, burnRate: 2, status: 'atrisk', total: 1000 });
  });

  it('evaluates a bounded percentile and exposes actionable ownership', () => {
    const level = new ServiceLevel({ id: 'latency', title: '延迟', indicator: { metric: 'commerce.operation.duration', type: 'percentile', percentile: 95 }, target: 100, unit: 'milliseconds', direction: 'maximum', windowSeconds: 300, severity: 'warning', owner: 'reliability', runbook: 'docs/operations/deployment.md' });
    const result = level.evaluate([10, 20, 30, 40, 150].map((value) => ({ name: 'commerce.operation.duration', value, result: 'success' })));
    expect(result).toMatchObject({ current: 150, burnRate: 1.5, status: 'atrisk', severity: 'warning', owner: 'reliability', total: 5 });
  });
});
