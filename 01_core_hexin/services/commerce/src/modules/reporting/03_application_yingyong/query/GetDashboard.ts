import { CACHE_CATALOG } from '@shop/config/runtime';
import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { operationLifecycle, requireAccess } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import { encodeCursor, queryPage } from '../../../../foundation/interface/Validation';
import type { Cache } from '../../../../foundation/cache/Cache';
import { VersionedKey } from '../../../../foundation/cache/VersionedKey';
import { SingleFlight } from '../../../../foundation/application/SingleFlight';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { MetricRow, ReportDimension, ReportPeriod } from '../../02_domain_yewu/model/Metric';
import type { ReportingFactory } from '../../01_public_gongkai/ReportingPort';

export function getDashboardOperations(factory: ReportingFactory<OperationDatabase>, pool: DatabasePool, cache: Cache,
  projectionVersion: (scope: string) => Promise<number> = (scope) => reportingProjectionVersion(pool, scope)): OperationActions {
  return { 'reporting.dashboard.read': metricOperation(factory, pool, cache, null, projectionVersion) };
}

export function metricOperation(factory: ReportingFactory<OperationDatabase>, pool: DatabasePool, cache: Cache, dimension: ReportDimension | null,
  projectionVersion: (scope: string) => Promise<number> = (scope) => reportingProjectionVersion(pool, scope)) {
  const active = new SingleFlight<OperationResult>();
  return operationLifecycle({
    prepare: async (request: OperationRequest) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const selectedPeriod = period(request);
      const application = queryText(request, 'applicationid');
      const supplier = queryText(request, 'supplierid');
      const selectedDimension = supplier === null ? dimension : supplierSection(request) ?? dimension;
      const cacheable = application === null && supplier === null && page.sort === null;
      const version = cacheable ? await projectionVersion(access.scope.id) : 0;
      const key = cacheable ? VersionedKey.create('reporting', { scope: access.scope.id,
        metric: selectedDimension ?? 'dashboard', period: selectedPeriod, projectionversion: version }) : null;
      const cached = key ? await cache.get<OperationResult>(key) : null;
      return { access, page, selectedPeriod, application, supplier, selectedDimension, key, cached };
    },
    shortCircuit: (_request, prepared) => prepared.cached ?? undefined,
    execute: async (_request, database, prepared) => {
      const load = async () => {
        const repository = factory(database);
        const rows = await repository.metrics({ scope: prepared.access.scope.id, dimension: prepared.selectedDimension,
          period: prepared.selectedPeriod, application: prepared.application, supplier: prepared.supplier,
          cursorTime: prepared.page.sort, cursorId: prepared.page.id, fetch: prepared.page.fetch });
        const summary = dimension === null
          ? await repository.cockpit(prepared.access.scope.id, prepared.supplier, prepared.selectedPeriod) : undefined;
        const result = metricPage(rows, prepared.page.limit, summary);
        if (prepared.key) await cache.put(prepared.key, result, CACHE_CATALOG.reporting.staleSeconds);
        return result;
      };
      return prepared.key ? active.run(prepared.key, load) : load();
    },
    finalize: async (_request, result) => result,
  });
}

async function reportingProjectionVersion(pool: DatabasePool, scope: string): Promise<number> {
  const projection = await pool.query<{ version: number }>(`select version::integer from runtime.projectionoffset
    where projection='commerce' and shard=$1`, [scope]);
  return projection.rows[0]?.version ?? 0;
}

function metricPage(rows: readonly MetricRow[], limit: number, summary?: unknown): OperationResult {
  const more = rows.length > limit;
  const visible = more ? rows.slice(0, limit) : rows;
  const last = visible.at(-1);
  const items = visible.map(({ cursorTime: _time, cursorId: _id, ...metric }) => metric);
  const nextCursor = more && last ? encodeCursor({ sort: cursorText(last.cursorTime), id: cursorText(last.cursorId) }) : undefined;
  return { status: 200, body: { items, count: items.length, ...(nextCursor ? { nextCursor } : {}), ...(summary === undefined ? {} : { summary }) } };
}

function cursorText(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) return value;
  throw new Error('CURSOR_RESULT_POSITION_INVALID');
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

function supplierSection(request: OperationRequest): ReportDimension | null {
  const value = queryText(request, 'suppliersection');
  if (value === null) return null;
  if (value === 'sales' || value === 'product' || value === 'category' || value === 'channel'
    || value === 'fulfillment' || value === 'settlement') return value;
  throw new Error('REPORT_SUPPLIER_SECTION_INVALID');
}
