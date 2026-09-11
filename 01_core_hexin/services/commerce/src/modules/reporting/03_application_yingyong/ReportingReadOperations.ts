import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, type OperationAction, type OperationActions } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest, OperationResult } from '../../../foundation/application/OperationHandler';
import { encodeCursor, queryPage, type QueryPage } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import type { MetricRow, ReportDimension, ReportPeriod } from '../02_domain_yewu/model/Metric';

interface MetricRecord {
  readonly code: string;
  readonly version: number;
  readonly scope: string;
  readonly period: { readonly from: string; readonly to: string; readonly timezone: string };
  readonly dimensions: Record<string, string>;
  readonly value: number;
  readonly unit: MetricRow['unit'];
  readonly watermark: string;
  readonly projectionVersion: number;
  readonly cursorTime: string;
  readonly cursorId: string;
}

export const REPORTING_OPERATOR_READ_OPERATION_IDS = Object.freeze([
  'reporting.categories.read',
  'reporting.channels.read',
  'reporting.malls.read',
  'reporting.powderclass.read',
  'reporting.products.read',
  'reporting.sales.read',
  'reporting.voucherconsumption.read',
] as const satisfies readonly OperationId[]);

export function reportingOperatorReadActions(): OperationActions {
  return {
    'reporting.categories.read': metricAction('category'),
    'reporting.channels.read': metricAction('channel'),
    'reporting.malls.read': metricAction('mall'),
    'reporting.powderclass.read': metricAction('powderclass'),
    'reporting.products.read': metricAction('product'),
    'reporting.sales.read': metricAction('sales'),
    'reporting.voucherconsumption.read': metricAction('voucher'),
  };
}

export function reportingOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('reporting', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    reportingOperatorReadActions(), REPORTING_OPERATOR_READ_OPERATION_IDS);
}

function metricAction(dimension: ReportDimension): OperationAction {
  return async (request, database) => {
    const access = requireAccess(request);
    const page = queryPage(request);
    const selectedPeriod = period(request);
    const application = queryText(request, 'applicationid');
    const supplier = queryText(request, 'supplierid');
    const selectedDimension = supplier === null ? dimension : supplierSection(request) ?? dimension;
    if (supplier !== null) {
      const result = await database.query<MetricRecord>(`select code,version,scope,period,dimensions,value,unit,
        watermark,"projectionVersion","cursorTime","cursorId" from (
          select item.code,item.version,item.scope,item.period,item.dimensions,item.value,item.unit,
            item.watermark,item.projection_version "projectionVersion",item.cursor_time "cursorTime",item.cursor_id "cursorId"
          from reporting.supplier_metric_rows($1,$2,$3,$4) item
        ) rows where ($5::timestamptz is null or ("cursorTime","cursorId")<($5::timestamptz,$6))
        order by "cursorTime" desc,"cursorId" desc limit $7`,
      [access.scope.id, supplier, selectedDimension, selectedPeriod, page.sort, page.id, page.fetch]);
      return metricPage(result.rows, page);
    }
    const result = await database.query<MetricRecord>(`select fact.metric_id code,fact.metric_version version,
      fact.scope_id scope,jsonb_build_object('from',fact.period_start,'to',fact.period_end,'timezone',fact.timezone) period,
      fact.dimensions,fact.value_numeric::float8 value,metric.unit,fact.watermark,fact.projection_version "projectionVersion",
      fact.period_end "cursorTime",fact.metric_id||':'||md5(fact.dimensions::text) "cursorId"
      from reporting.fact fact join reporting.metric metric on metric.id=fact.metric_id and metric.version=fact.metric_version
      where fact.scope_id=$1 and fact.metric_id like $2||'.%'
        and ($3::text is null or fact.dimensions->>'application'=$3)
        and fact.period_start>=case $4 when 'yesterday' then date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone-interval '1 day'
          when '7days' then date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone-interval '6 days'
          when '30days' then date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone-interval '29 days'
          else date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone end
        and ($4<>'yesterday' or fact.period_end<=date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone)
        and ($5::timestamptz is null or (fact.period_end,fact.metric_id||':'||md5(fact.dimensions::text))<($5::timestamptz,$6))
      order by fact.period_end desc,"cursorId" desc limit $7`,
    [access.scope.id, dimension, application, selectedPeriod, page.sort, page.id, page.fetch]);
    return metricPage(result.rows, page);
  };
}

function metricPage(rows: readonly MetricRecord[], page: QueryPage): OperationResult {
  const more = rows.length > page.limit;
  const visible = more ? rows.slice(0, page.limit) : rows;
  const last = visible.at(-1);
  const items = visible.map(({ cursorTime: _time, cursorId: _id, ...metric }) => metric);
  const nextCursor = more && last ? encodeCursor({ sort: last.cursorTime, id: last.cursorId }) : undefined;
  return { status: 200, body: { items, count: items.length, ...(nextCursor ? { nextCursor } : {}) } };
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

function supplierSection(request: OperationRequest): ReportDimension | null {
  const value = queryText(request, 'suppliersection');
  if (value === null) return null;
  if (value === 'sales' || value === 'product' || value === 'category' || value === 'channel'
    || value === 'fulfillment' || value === 'settlement') return value;
  throw new Error('REPORT_SUPPLIER_SECTION_INVALID');
}
