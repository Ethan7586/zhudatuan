import { CACHE_CATALOG } from '@shop/config/runtime';
import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { operationLifecycle, requireAccess } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import { encodeCursor, queryPage } from '../../../../foundation/interface/Validation';
import type { Cache } from '../../../../foundation/cache/Cache';
import { VersionedKey } from '../../../../foundation/cache/VersionedKey';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { MetricRow, ReportDimension, ReportPeriod } from '../../domain/model/Metric';
import type { ReportingFactory } from '../port/ReportingPort';

export function getDashboardOperations(factory: ReportingFactory<OperationDatabase>, pool: DatabasePool, cache: Cache): OperationActions {
  return { 'reporting.dashboard.read': metricOperation(factory, pool, cache, null) };
}

export function metricOperation(factory: ReportingFactory<OperationDatabase>, pool: DatabasePool, cache: Cache, dimension: ReportDimension | null) {
  return operationLifecycle({
    prepare: async (request: OperationRequest) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const selectedPeriod = period(request);
      const application = queryText(request, 'applicationid');
      const cacheable = application === null && page.sort === null;
      const projection = cacheable ? await pool.query<{ version: number }>(`select version::integer from runtime.projectionoffset
        where projection='commerce' and shard=$1`, [access.scope.id]) : null;
      const version = projection?.rows[0]?.version ?? 0;
      const key = cacheable ? VersionedKey.create('reporting', { scope: access.scope.id, metric: dimension ?? 'dashboard', period: selectedPeriod,
        projectionversion: version }) : null;
      const cached = key ? await cache.get<OperationResult>(key) : null;
      return { access, page, selectedPeriod, application, key, cached };
    },
    shortCircuit: (_request, prepared) => prepared.cached ?? undefined,
    execute: async (_request, database, prepared) => {
      const repository = factory(database);
      const rows = await repository.metrics({ scope: prepared.access.scope.id, dimension, period: prepared.selectedPeriod,
        application: prepared.application, cursorTime: prepared.page.sort, cursorId: prepared.page.id, fetch: prepared.page.fetch });
      const summary = dimension === null ? await repository.cockpit(prepared.access.scope.id) : undefined;
      return metricPage(rows, prepared.page.limit, summary);
    },
    finalize: async (_request, result, prepared) => {
      if (prepared.key) await cache.put(prepared.key, result, CACHE_CATALOG.reporting.staleSeconds);
      return result;
    },
  });
}

function metricPage(rows: readonly MetricRow[], limit: number, summary?: unknown): OperationResult {
  const more = rows.length > limit;
  const visible = more ? rows.slice(0, limit) : rows;
  const last = visible.at(-1);
  const items = visible.map(({ cursorTime: _time, cursorId: _id, ...metric }) => metric);
  const nextCursor = more && last ? encodeCursor({ sort: last.cursorTime, id: last.cursorId }) : undefined;
  return { status: 200, body: { items, count: items.length, ...(nextCursor ? { nextCursor } : {}), ...(summary === undefined ? {} : { summary }) } };
}

function period(request: OperationRequest): ReportPeriod {
  const value = queryText(request, 'period');
  if (value === null || value === 'realtime') return 'realtime';
  if (value === 'yesterday' || value === '7days' || value === '30days') return value;
  throw new Error('REPORT_PERIOD_INVALID');
}

function queryText(request: OperationRequest, name: string): string | null {
  const raw = request.input.query[name]; const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined) return null;
  if (!value || value.length > 100) throw new Error('REPORT_FILTER_INVALID');
  return value;
}
