import { describe, expect, it } from 'vitest';
import { AlertRule } from '../../domain/model/AlertRule';
import { ServiceLevel } from '../../domain/model/ServiceLevel';
import { ObservationRegistry } from './ObservationRegistry';

describe('ObservationRegistry', () => {
  it('publishes bounded health, metric, SLO and alert catalogs', () => {
    const catalog = registry().catalog();
    expect(catalog.healthChecks).toEqual(['dependency', 'queue', 'provider', 'servicelevel', 'release']);
    expect(catalog.metrics).toEqual(['commerce.operation.count']);
    expect(catalog.serviceLevels).toEqual([expect.objectContaining({ id: 'availability', owner: 'reliability' })]);
    expect(catalog.alerts).toEqual([expect.objectContaining({ id: 'burn', runbook: 'docs/operations/deployment.md' })]);
  });

  it('rejects an alert that references an unregistered SLO', () => {
    const alert = new AlertRule({ id: 'burn', title: '预算', signal: 'slo.missing', measure: 'burnrate', threshold: 2, windowSeconds: 300, severity: 'critical', owner: 'reliability', runbook: 'docs/operations/deployment.md' });
    expect(() => new ObservationRegistry(health, [level()], [alert])).toThrow('ALERT_SERVICE_LEVEL_MISSING:burn');
  });
});

const health = { freshnessSeconds: 300, queueBacklogDepth: 1000, checks: ['dependency', 'queue', 'provider', 'servicelevel', 'release'] } as const;

function registry(): ObservationRegistry {
  const alert = new AlertRule({ id: 'burn', title: '预算', signal: 'slo.availability', measure: 'burnrate', threshold: 2, windowSeconds: 300, severity: 'critical', owner: 'reliability', runbook: 'docs/operations/deployment.md' });
  return new ObservationRegistry(health, [level()], [alert]);
}

function level(): ServiceLevel {
  return new ServiceLevel({ id: 'availability', title: '可用率', indicator: { metric: 'commerce.operation.count', type: 'ratio', goodResult: 'success' }, target: 99.95, unit: 'percent', direction: 'minimum', windowSeconds: 300, severity: 'critical', owner: 'reliability', runbook: 'docs/operations/deployment.md' });
}
