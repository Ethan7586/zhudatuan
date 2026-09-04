import type { AlertRule } from '../../domain/model/AlertRule';
import type { ServiceLevel } from '../../domain/model/ServiceLevel';
import type { ObservabilityCatalog } from '../../public';

export interface HealthPolicy {
  readonly freshnessSeconds: number;
  readonly queueBacklogDepth: number;
  readonly checks: readonly string[];
}

export class ObservationRegistry {
  constructor(
    readonly health: Readonly<HealthPolicy>,
    readonly serviceLevels: readonly ServiceLevel[],
    readonly alerts: readonly AlertRule[]
  ) {
    unique(health.checks, 'HEALTH_CHECK_DUPLICATE');
    unique(serviceLevels.map(({ definition }) => definition.id), 'SERVICE_LEVEL_CATALOG_DUPLICATE');
    unique(alerts.map(({ definition }) => definition.id), 'ALERT_RULE_CATALOG_DUPLICATE');
    const levelIds = new Set(serviceLevels.map(({ definition }) => definition.id));
    for (const { definition } of alerts) {
      if (definition.signal.startsWith('slo.') && !levelIds.has(definition.signal.slice(4))) throw new Error(`ALERT_SERVICE_LEVEL_MISSING:${definition.id}`);
    }
    Object.freeze(this.serviceLevels);
    Object.freeze(this.alerts);
  }

  catalog(): ObservabilityCatalog {
    const metricIds = new Set([
      ...this.serviceLevels.map(({ definition }) => definition.indicator.metric),
      ...this.alerts.flatMap(({ definition }) => definition.signal.startsWith('slo.') ? [] : [definition.signal]),
    ]);
    return Object.freeze({
      healthChecks: Object.freeze([...this.health.checks]),
      metrics: Object.freeze([...metricIds].sort()),
      serviceLevels: Object.freeze(this.serviceLevels.map(({ definition }) => Object.freeze(published(definition)))),
      alerts: Object.freeze(this.alerts.map(({ definition }) => Object.freeze(published(definition)))),
    });
  }
}

function published(value: Readonly<{ id: string; title: string; owner: string; severity: string; runbook: string }>) {
  return { id: value.id, title: value.title, owner: value.owner, severity: value.severity, runbook: value.runbook };
}

function unique(values: readonly string[], code: string): void {
  if (values.length === 0 || new Set(values).size !== values.length) throw new Error(code);
}
