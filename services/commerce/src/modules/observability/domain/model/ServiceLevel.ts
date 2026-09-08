export type ServiceLevelStatus = 'healthy' | 'atrisk' | 'breaching' | 'nodata';
export type ServiceLevelSeverity = 'warning' | 'critical';
export type ServiceLevelUnit = 'percent' | 'milliseconds' | 'seconds';

export type ServiceIndicator = Readonly<{ metric: string; type: 'ratio'; goodResult: string }> | Readonly<{ metric: string; type: 'percentile'; percentile: 50 | 90 | 95 | 99 }>;

export interface ServiceLevelDefinition {
  readonly id: string;
  readonly title: string;
  readonly indicator: ServiceIndicator;
  readonly target: number;
  readonly unit: ServiceLevelUnit;
  readonly direction: 'minimum' | 'maximum';
  readonly windowSeconds: number;
  readonly severity: ServiceLevelSeverity;
  readonly owner: string;
  readonly runbook: string;
}

export interface MetricPoint {
  readonly name: string;
  readonly value: number;
  readonly result: string | null;
}

export interface ServiceLevelEvaluation {
  readonly id: string;
  readonly title: string;
  readonly indicator: string;
  readonly owner: string;
  readonly target: number;
  readonly current: number | null;
  readonly unit: ServiceLevelUnit;
  readonly windowSeconds: number;
  readonly severity: ServiceLevelSeverity;
  readonly runbook: string;
  readonly status: ServiceLevelStatus;
  readonly burnRate: number | null;
  readonly errorBudgetRemainingPercent: number | null;
  readonly total: number;
}

export class ServiceLevel {
  readonly definition: Readonly<ServiceLevelDefinition>;

  constructor(definition: ServiceLevelDefinition) {
    assertDefinition(definition);
    this.definition = Object.freeze({ ...definition, indicator: Object.freeze({ ...definition.indicator }) });
  }

  evaluate(points: readonly MetricPoint[]): ServiceLevelEvaluation {
    const selected = points.filter((point) => point.name === this.definition.indicator.metric && Number.isFinite(point.value) && point.value >= 0);
    const current = this.definition.indicator.type === 'ratio' ? ratio(selected, this.definition.indicator.goodResult) : percentile(selected, this.definition.indicator.percentile);
    const burnRate = current === null ? null : burn(this.definition, current);
    return Object.freeze({
      id: this.definition.id,
      title: this.definition.title,
      indicator: this.definition.indicator.metric,
      owner: this.definition.owner,
      target: this.definition.target,
      current,
      unit: this.definition.unit,
      windowSeconds: this.definition.windowSeconds,
      severity: this.definition.severity,
      runbook: this.definition.runbook,
      status: status(burnRate),
      burnRate,
      errorBudgetRemainingPercent: burnRate === null ? null : round(Math.max(0, 100 - burnRate * 100)),
      total: this.definition.indicator.type === 'ratio' ? Math.trunc(selected.reduce((sum, point) => sum + point.value, 0)) : selected.length,
    });
  }
}

function assertDefinition(value: ServiceLevelDefinition): void {
  if (
    !/^[a-z][a-z0-9]*$/.test(value.id) ||
    !value.title.trim() ||
    !metricPattern.test(value.indicator.metric) ||
    !Number.isFinite(value.target) ||
    value.target <= 0 ||
    !Number.isSafeInteger(value.windowSeconds) ||
    value.windowSeconds < 60 ||
    !/^[a-z][a-z0-9]*$/.test(value.owner) ||
    !runbookPattern.test(value.runbook)
  ) {
    throw new Error(`SERVICE_LEVEL_INVALID:${value.id}`);
  }
  if (!['minimum', 'maximum'].includes(value.direction) || !['percent', 'milliseconds', 'seconds'].includes(value.unit) || !['warning', 'critical'].includes(value.severity)) throw new Error(`SERVICE_LEVEL_INVALID:${value.id}`);
  if (value.direction === 'minimum' && (value.unit !== 'percent' || value.target >= 100 || value.indicator.type !== 'ratio')) throw new Error(`SERVICE_LEVEL_DIRECTION_INVALID:${value.id}`);
  if (value.direction === 'maximum' && value.indicator.type !== 'percentile') throw new Error(`SERVICE_LEVEL_DIRECTION_INVALID:${value.id}`);
  if (value.indicator.type === 'ratio' && !value.indicator.goodResult) throw new Error(`SERVICE_LEVEL_INDICATOR_INVALID:${value.id}`);
  if (value.indicator.type === 'percentile' && ![50, 90, 95, 99].includes(value.indicator.percentile)) throw new Error(`SERVICE_LEVEL_INDICATOR_INVALID:${value.id}`);
}

function ratio(points: readonly MetricPoint[], goodResult: string): number | null {
  const total = points.reduce((sum, point) => sum + point.value, 0);
  if (total === 0) return null;
  const good = points.filter((point) => point.result === goodResult).reduce((sum, point) => sum + point.value, 0);
  return round((good / total) * 100);
}

function percentile(points: readonly MetricPoint[], rank: number): number | null {
  if (points.length === 0) return null;
  const values = points.map(({ value }) => value).sort((left, right) => left - right);
  return round(values[Math.max(0, Math.ceil((rank / 100) * values.length) - 1)]!);
}

function burn(definition: ServiceLevelDefinition, current: number): number {
  return round(definition.direction === 'minimum' ? (100 - current) / (100 - definition.target) : current / definition.target);
}

function status(rate: number | null): ServiceLevelStatus {
  return rate === null ? 'nodata' : rate <= 1 ? 'healthy' : rate <= 2 ? 'atrisk' : 'breaching';
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

const metricPattern = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;
const runbookPattern = /^docs\/operations\/[a-z0-9]+\.md$/;
