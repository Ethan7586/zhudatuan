import { deepFreeze } from '../../../shared/model/Immutable';
import type { ControlPage, Distributor, PlatformLayer, RuntimeHealth } from '../model/Control';
import { DistributionPageSchema, PlatformPageSchema, RuntimeHealthSchema, type PlatformPageDto } from './ControlSchema';

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

  private page<TSource, TTarget>(page: Readonly<{ items: readonly TSource[]; count: number; nextCursor?: string | undefined }>, map: (item: TSource) => TTarget): ControlPage<TTarget> {
    if (page.count !== page.items.length) throw new Error('CONTROL_PAGE_COUNT_MISMATCH');
    const result: ControlPage<TTarget> = { items: page.items.map(map), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) };
    return deepFreeze(result) as ControlPage<TTarget>;
  }
}
