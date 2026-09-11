import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess } from '../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import { encodeCursor, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import type { CockpitSummary, MetricRow, ReportPeriod } from '../reporting';
import { WEB_REPORTING_OPERATION_IDS } from './WebBusinessOperationIds';

interface MetricRecord {
  readonly code: string;
  readonly version: number;
  readonly scope: string;
  readonly period: Readonly<{ from: string; to: string; timezone: string }>;
  readonly dimensions: Readonly<Record<string, string>>;
  readonly value: number;
  readonly unit: MetricRow['unit'];
  readonly watermark: string;
  readonly projectionVersion: number;
  readonly cursorTime: string;
  readonly cursorId: string;
}

export function webReportingOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('reporting', pool, context.container.get(AUDIT_SINK), {
    'reporting.dashboard.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const selectedPeriod = period(request);
      const application = queryText(request, 'applicationid');
      const result = await database.query<MetricRecord>(`select fact.metric_id code,fact.metric_version version,fact.scope_id scope,
        jsonb_build_object('from',fact.period_start,'to',fact.period_end,'timezone',fact.timezone) period,fact.dimensions,
        fact.value_numeric::float8 value,metric.unit,fact.watermark,fact.projection_version::float8 "projectionVersion",
        fact.period_end "cursorTime",fact.metric_id||':'||md5(fact.dimensions::text) "cursorId"
        from reporting.fact fact join reporting.metric metric on metric.id=fact.metric_id and metric.version=fact.metric_version
        where fact.scope_id=$1 and ($2::text is null or fact.dimensions->>'application'=$2)
          and fact.period_start>=case $3 when 'yesterday' then date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone-interval '1 day'
            when '7days' then date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone-interval '6 days'
            when '30days' then date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone-interval '29 days'
            else date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone end
          and ($3<>'yesterday' or fact.period_end<=date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone)
          and ($4::timestamptz is null or (fact.period_end,fact.metric_id||':'||md5(fact.dimensions::text))<($4::timestamptz,$5))
        order by fact.period_end desc,"cursorId" desc limit $6`,
      [access.scope.id, application, selectedPeriod, page.sort, page.id, page.fetch]);
      const summaryResult = await database.query<{ summary: CockpitSummary }>('select reporting.cockpit($1) summary', [access.scope.id]);
      const summary = summaryResult.rows[0]?.summary;
      if (!summary) throw new Error('REPORT_COCKPIT_FAILED');
      const more = result.rows.length > page.limit;
      const visible = more ? result.rows.slice(0, page.limit) : result.rows;
      const last = visible.at(-1);
      const items = visible.map(({ cursorTime: _time, cursorId: _id, ...metric }) => metric);
      const nextCursor = more && last ? encodeCursor({ sort: instant(last.cursorTime), id: last.cursorId }) : undefined;
      return { status: 200, body: {
        items,
        count: items.length,
        ...(nextCursor ? { nextCursor } : {}),
        summary,
      } };
    },
  }, WEB_REPORTING_OPERATION_IDS);
}

function period(request: OperationRequest): ReportPeriod {
  const value = queryText(request, 'period');
  if (value === null || value === 'realtime') return 'realtime';
  if (value === 'yesterday' || value === '7days' || value === '30days') return value;
  throw new Error('REPORT_PERIOD_INVALID');
}

function queryText(request: OperationRequest, name: string): string | null {
  const raw = request.input.query[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined) return null;
  if (!value || value.length > 100) throw new Error('REPORT_FILTER_INVALID');
  return value;
}

function instant(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
