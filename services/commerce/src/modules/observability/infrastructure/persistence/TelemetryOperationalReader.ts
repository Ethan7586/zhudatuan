import { CONFIG_CHECKSUM } from '@shop/config/runtime';
import { TARGET_SCHEMA_HEAD } from '@shop/config/server';
import { CONTRACT_CHECKSUM } from '@shop/contract';
import { TELEMETRY_BUFFER } from '@shop/telemetry';
import type { ObservationReader, TelemetryObservation } from '@shop/telemetry';
import type { DependencyHealth, HealthOverview, OperationalReader, ProviderHealth, QueueHealth, ServiceLevelReport, ServiceLevelResult } from '../../application/port/OperationalReader';
import type { ObservationRegistry } from '../../application/registry/ObservationRegistry';
import type { MetricPoint } from '../../domain/model/ServiceLevel';

export class TelemetryOperationalReader implements OperationalReader {
  private readonly startedAt: string;

  constructor(
    private readonly observations: ObservationReader,
    private readonly registry: ObservationRegistry,
    private readonly now = () => Date.now()
  ) {
    this.startedAt = new Date(now()).toISOString();
  }

  async overview(): Promise<HealthOverview> {
    const generatedAt = new Date(this.now()).toISOString();
    const records = this.records(generatedAt);
    const dependencies = latestDependencies(records);
    const queues = latestQueues(records, this.registry.health.queueBacklogDepth);
    const providers = latestProviders(records);
    const levels = serviceLevels(records, generatedAt, this.registry);
    const checks = new Set(this.registry.health.checks);
    const degraded = Object.freeze([
      ...(checks.has('dependency') ? (dependencies.length === 0 ? ['dependency.telemetry.missing'] : dependencies.filter((item) => item.state === 'unhealthy').map((item) => `dependency.${item.name}`)) : []),
      ...(checks.has('queue') ? (queues.length === 0 ? ['queue.telemetry.missing'] : queues.filter((item) => item.state === 'backlogged').map((item) => `queue.${item.name}`)) : []),
      ...(checks.has('provider') ? (providers.length === 0 ? ['provider.telemetry.missing'] : providers.filter((item) => item.state === 'degraded').map((item) => `provider.${item.name}`)) : []),
      ...(checks.has('servicelevel') ? levels.items.filter((item) => item.status === 'breaching').map((item) => `slo.${item.id}`) : []),
    ]);
    return Object.freeze({
      generatedAt,
      condition: degraded.length === 0 ? 'healthy' : 'degraded',
      degraded,
      dependencies,
      queues,
      providers,
      serviceLevels: summarize(levels.items),
      release: Object.freeze({ version: CONTRACT_CHECKSUM.slice(0, 12), contract: CONTRACT_CHECKSUM, configuration: CONFIG_CHECKSUM, schema: TARGET_SCHEMA_HEAD, startedAt: this.startedAt }),
    });
  }

  async serviceLevels(): Promise<ServiceLevelReport> {
    const generatedAt = new Date(this.now()).toISOString();
    return serviceLevels(this.records(generatedAt), generatedAt, this.registry);
  }

  private records(at: string): readonly TelemetryObservation[] {
    return this.observations.read(new Date(Date.parse(at) - this.registry.health.freshnessSeconds * 1_000).toISOString(), TELEMETRY_BUFFER.maximumRead);
  }
}

function latestDependencies(records: readonly TelemetryObservation[]): readonly DependencyHealth[] {
  return latest(records, 'commerce.dependency.duration', 'dependency').map(({ key, item }) =>
    Object.freeze({
      name: key,
      state: text(item.record.result) === 'success' ? 'healthy' : 'unhealthy',
      durationMs: numeric(item.record.value),
      observedAt: item.observedAt,
      traceId: text(item.record.traceId),
    })
  );
}

function latestQueues(records: readonly TelemetryObservation[], backlogDepth: number): readonly QueueHealth[] {
  return latest(records, 'commerce.queue.depth', 'queue').map(({ key, item }) => {
    const depth = Math.max(0, Math.trunc(numeric(item.record.value)));
    return Object.freeze({ name: key, state: text(item.record.result) === 'backlogged' || depth >= backlogDepth ? 'backlogged' : depth === 0 ? 'idle' : 'active', depth, observedAt: item.observedAt });
  });
}

function latestProviders(records: readonly TelemetryObservation[]): readonly ProviderHealth[] {
  return latest(records, 'commerce.provider.count', 'provider').map(({ key, item }) =>
    Object.freeze({
      name: key,
      state: text(item.record.result) === 'success' ? 'healthy' : 'degraded',
      operation: text(item.record.operation),
      observedAt: item.observedAt,
      traceId: text(item.record.traceId),
    })
  );
}

function serviceLevels(records: readonly TelemetryObservation[], generatedAt: string, registry: ObservationRegistry): ServiceLevelReport {
  const pointsFor = (window: number): readonly MetricPoint[] =>
    Object.freeze(
      records.flatMap(({ observedAt, record }) =>
        Date.parse(observedAt) >= Date.parse(generatedAt) - window * 1_000 && record.kind === 'metric' && text(record.name) !== null
          ? [Object.freeze({ name: text(record.name)!, value: numeric(record.value), result: text(record.result) })]
          : []
      )
    );
  const items = Object.freeze(registry.serviceLevels.map((level) => level.evaluate(pointsFor(level.definition.windowSeconds))));
  return Object.freeze({ generatedAt, windowSeconds: registry.health.freshnessSeconds, items, count: items.length });
}

function latest(records: readonly TelemetryObservation[], name: string, key: string): readonly Readonly<{ key: string; item: TelemetryObservation }>[] {
  const values = new Map<string, TelemetryObservation>();
  for (const item of records) {
    if (item.record.kind !== 'metric' || item.record.name !== name) continue;
    const value = text(item.record[key]);
    if (value !== null) values.set(value, item);
  }
  return Object.freeze([...values.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([value, item]) => Object.freeze({ key: value, item })));
}

function summarize(items: readonly ServiceLevelResult[]) {
  return Object.freeze({
    healthy: items.filter((item) => item.status === 'healthy').length,
    atRisk: items.filter((item) => item.status === 'atrisk').length,
    breaching: items.filter((item) => item.status === 'breaching').length,
    noData: items.filter((item) => item.status === 'nodata').length,
  });
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
