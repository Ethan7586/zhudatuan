import { deepFreeze } from '../../../shared/model/Immutable';
import type { CapabilityHealth, ControlPage, Distributor, ExtensionHealth, ObservabilityHealth, PlatformLayer, RiskHealth, RuntimeHealth, ServiceLevelHealth } from '../model/Control';
import { CapabilityPageSchema, DistributionPageSchema, ExtensionPageSchema, ObservabilityHealthSchema, PlatformPageSchema, RiskPageSchema, RuntimeHealthSchema, ServiceLevelSchema, type PlatformPageDto } from './ControlSchema';

export class ControlMapper {
  platform(value: unknown): ControlPage<PlatformLayer> {
    const page = PlatformPageSchema.parse(value) as PlatformPageDto;
    return this.page(page, (item) => ({ id: item.id, kind: item.kind, parentId: item.parent_id, parentName: item.parent_name, name: item.name, timezone: item.timezone, status: item.status, version: item.version }));
  }

  distribution(value: unknown): ControlPage<Distributor> {
    const page = DistributionPageSchema.parse(value);
    return this.page(page, (item) => ({
      id: item.id,
      organizationId: item.organization_id,
      code: item.code,
      name: item.name,
      settlementMode: item.settlement_mode,
      status: item.status,
      tenantCount: item.tenant_count,
      updatedAt: item.updated_at,
    }));
  }

  runtime(value: unknown): RuntimeHealth {
    const health = RuntimeHealthSchema.parse(value);
    return deepFreeze({
      status: health.status,
      queue: { queued: health.queue.queued, running: health.queue.running, deadletters: health.queue.deadletters, oldestSeconds: health.queue.oldest_seconds },
      cache: { available: health.cache.available, ...(health.cache.reason === undefined ? {} : { reason: health.cache.reason }) },
      databaseQueries: health.databaseQueries.map((item) => ({ workload: item.workload, count: item.count, failures: item.failures, totalMilliseconds: item.totalMilliseconds, maximumMilliseconds: item.maximumMilliseconds })),
      readiness: {
        healthy: health.readiness.healthy,
        condition: health.readiness.condition,
        degraded: health.readiness.degraded,
        configuration: health.readiness.configuration,
        contract: health.readiness.contract,
        migration: health.readiness.migration,
        registries: health.readiness.registries,
        database: health.readiness.database,
        extensions: health.readiness.extensions,
      },
    });
  }

  capabilities(value: unknown): CapabilityHealth {
    const page = CapabilityPageSchema.parse(value);
    return deepFreeze({
      count: page.count,
      enabled: page.items.filter((item) => item.state === 'enabled').length,
      disabled: page.items.filter((item) => item.state === 'disabled').length,
      dependencyIssues: page.items.filter((item) => !item.dependencyHealthy).length,
    });
  }

  extensions(value: unknown): ExtensionHealth {
    const page = ExtensionPageSchema.parse(value);
    return deepFreeze({
      count: page.count,
      enabled: page.items.filter((item) => item.status === 'enabled').length,
      healthy: page.items.filter((item) => item.health_state === 'healthy').length,
      degraded: page.items.filter((item) => item.status === 'degraded' || item.health_state === 'degraded').length,
      unavailable: page.items.filter((item) => item.health_state === 'unavailable').length,
    });
  }

  risk(value: unknown): RiskHealth {
    const page = RiskPageSchema.parse(value);
    const policies = page.items.filter((item) => item.kind === 'policy');
    const cases = page.items.filter((item) => item.kind === 'case');
    return deepFreeze({
      count: page.count,
      policies: policies.length,
      activePolicies: policies.filter((item) => item.status === 'active').length,
      cases: cases.length,
      openCases: cases.filter((item) => item.case_state === 'open' || item.case_state === 'reviewing').length,
    });
  }

  observability(value: unknown): ObservabilityHealth {
    const health = ObservabilityHealthSchema.parse(value);
    return deepFreeze({
      generatedAt: health.generatedAt,
      condition: health.condition,
      degraded: health.degraded.length,
      unhealthyDependencies: health.dependencies.filter((item) => item.state === 'unhealthy').length,
      backloggedQueues: health.queues.filter((item) => item.state === 'backlogged').length,
      degradedProviders: health.providers.filter((item) => item.state === 'degraded').length,
      release: health.release.version,
    });
  }

  serviceLevels(value: unknown): ServiceLevelHealth {
    const page = ServiceLevelSchema.parse(value);
    return deepFreeze({
      count: page.count,
      healthy: page.items.filter((item) => item.status === 'healthy').length,
      atRisk: page.items.filter((item) => item.status === 'atrisk').length,
      breaching: page.items.filter((item) => item.status === 'breaching').length,
      noData: page.items.filter((item) => item.status === 'nodata').length,
    });
  }

  private page<TSource, TTarget>(page: Readonly<{ items: readonly TSource[]; count: number; nextCursor?: string | undefined }>, map: (item: TSource) => TTarget): ControlPage<TTarget> {
    if (page.count !== page.items.length) throw new Error('CONTROL_PAGE_COUNT_MISMATCH');
    const result: ControlPage<TTarget> = { items: page.items.map(map), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) };
    return deepFreeze(result) as ControlPage<TTarget>;
  }
}
