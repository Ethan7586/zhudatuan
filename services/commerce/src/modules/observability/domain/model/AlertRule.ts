import type { ServiceLevelSeverity } from './ServiceLevel';

export interface AlertRuleDefinition {
  readonly id: string;
  readonly title: string;
  readonly signal: string;
  readonly measure: 'count' | 'percent' | 'burnrate' | 'inversepercent' | 'failurepercent' | 'seconds';
  readonly threshold: number;
  readonly windowSeconds: number;
  readonly severity: ServiceLevelSeverity;
  readonly owner: string;
  readonly runbook: string;
}

export class AlertRule {
  readonly definition: Readonly<AlertRuleDefinition>;

  constructor(definition: AlertRuleDefinition) {
    if (
      !/^[a-z][a-z0-9]*$/.test(definition.id) ||
      !definition.title.trim() ||
      !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(definition.signal) ||
      !['count', 'percent', 'burnrate', 'inversepercent', 'failurepercent', 'seconds'].includes(definition.measure) ||
      !Number.isFinite(definition.threshold) ||
      definition.threshold < 0 ||
      !Number.isSafeInteger(definition.windowSeconds) ||
      definition.windowSeconds < 60 ||
      !['warning', 'critical'].includes(definition.severity) ||
      !/^[a-z][a-z0-9]*$/.test(definition.owner) ||
      !/^docs\/operations\/[a-z0-9]+\.md$/.test(definition.runbook)
    )
      throw new Error(`ALERT_RULE_INVALID:${definition.id}`);
    this.definition = Object.freeze({ ...definition });
  }

  active(value: number | null): boolean {
    return value !== null && Number.isFinite(value) && value > this.definition.threshold;
  }
}
