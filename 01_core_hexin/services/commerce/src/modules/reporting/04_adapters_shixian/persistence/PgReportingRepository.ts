import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { ReportingPort } from '../../01_public_gongkai/ReportingPort';
import { orderExportFields, type ExportJob, type ExportReport, type ExportRow, type OrderExportField } from '../../02_domain_yewu/model/ExportJob';
import type { CockpitSummary, Metric, MetricQuery, MetricRow } from '../../02_domain_yewu/model/Metric';
import type { OrderProjection, ProjectionEvent } from '../../02_domain_yewu/model/Projection';

interface MetricRecord {
  readonly code: string; readonly version: number; readonly scope: string; readonly period: { from: string; to: string; timezone: string };
  readonly dimensions: Record<string, string>; readonly value: number; readonly unit: Metric['unit']; readonly watermark: string;
  readonly projectionVersion: number; readonly cursorTime: string; readonly cursorId: string;
}

interface ExportRecord {
  readonly id: string; readonly scope: string; readonly report: ExportReport; readonly filter: Record<string, unknown>;
  readonly state: ExportJob['state']; readonly cursor: string | null; readonly recordCount: number; readonly objectReference: string | null;
  readonly objectHash: string | null; readonly objectSize: number | null; readonly scanState: ExportJob['scanState'];
  readonly expiresAt: string | null; readonly createdAt: string; readonly generatedAt: string | null;
  readonly errorCode: string | null;
}

export class PgReportingRepository implements ReportingPort {
  constructor(private readonly database: OperationDatabase) {}

  async dashboard(query: MetricQuery): Promise<Readonly<{ rows: readonly MetricRow[]; summary: CockpitSummary }>> {
    if (query.supplier !== null && query.dimension !== null) {
      const result = await this.database.query<{ metrics: readonly MetricRecord[]; summary: CockpitSummary }>(`select
        coalesce(jsonb_agg(to_jsonb(rows) order by rows."cursorTime" desc,rows."cursorId" desc),'[]'::jsonb) metrics,
        reporting.cockpit($1,$2,$4) summary from (
          select code,version,scope,period,dimensions,value,unit,watermark,"projectionVersion","cursorTime","cursorId" from (
            select item.code,item.version,item.scope,item.period,item.dimensions,item.value,item.unit,
              item.watermark,CAST(item.projection_version AS float8) "projectionVersion",item.cursor_time "cursorTime",item.cursor_id "cursorId"
            from reporting.supplier_metric_rows($1,$2,$3,$4) item
          ) metric_rows where ($5::timestamptz is null or ("cursorTime","cursorId")<($5::timestamptz,$6))
          order by "cursorTime" desc,"cursorId" desc limit $7
        ) rows`,
      [query.scope, query.supplier, query.dimension, query.period, query.cursorTime, query.cursorId, query.fetch]);
      return dashboardResult(required(result.rows[0], 'REPORT_COCKPIT_FAILED'));
    }
    const result = await this.database.query<{ metrics: readonly MetricRecord[]; summary: CockpitSummary }>(`select
      coalesce(jsonb_agg(to_jsonb(rows) order by rows."cursorTime" desc,rows."cursorId" desc),'[]'::jsonb) metrics,
      reporting.cockpit($1,$8,$4) summary from (
        select fact.metric_id code,fact.metric_version version,fact.scope_id scope,
          jsonb_build_object('from',fact.period_start,'to',fact.period_end,'timezone',fact.timezone) period,fact.dimensions,
          fact.value_numeric::float8 value,metric.unit, fact.watermark, CAST(fact.projection_version AS float8) "projectionVersion",
          fact.period_end "cursorTime",fact.metric_id||':'||md5(fact.dimensions::text) "cursorId"
        from reporting.fact fact join reporting.metric metric on metric.id=fact.metric_id and metric.version=fact.metric_version
        where fact.scope_id=$1 and ($2::text is null or fact.metric_id like $2||'.%')
          and ($3::text is null or fact.dimensions->>'application'=$3)
          and fact.period_start>=case $4 when 'yesterday' then date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone-interval '1 day'
            when '7days' then date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone-interval '6 days'
            when '30days' then date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone-interval '29 days'
            else date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone end
          and ($4<>'yesterday' or fact.period_end<=date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone)
          and ($5::timestamptz is null or (fact.period_end,fact.metric_id||':'||md5(fact.dimensions::text))<($5::timestamptz,$6))
        order by fact.period_end desc,"cursorId" desc limit $7
      ) rows`,
    [query.scope, query.dimension, query.application, query.period, query.cursorTime, query.cursorId, query.fetch, query.supplier]);
    return dashboardResult(required(result.rows[0], 'REPORT_COCKPIT_FAILED'));
  }

  async metrics(query: MetricQuery): Promise<readonly MetricRow[]> {
    if (query.supplier !== null && query.dimension !== null) {
      const result = await this.database.query<MetricRecord>(`select code,version,scope,period,dimensions,value,unit,
        watermark,"projectionVersion","cursorTime","cursorId" from (
          select item.code,item.version,item.scope,item.period,item.dimensions,item.value,item.unit,
            item.watermark,CAST(item.projection_version AS float8) "projectionVersion",item.cursor_time "cursorTime",item.cursor_id "cursorId"
          from reporting.supplier_metric_rows($1,$2,$3,$4) item
        ) rows where ($5::timestamptz is null or ("cursorTime","cursorId")<($5::timestamptz,$6))
        order by "cursorTime" desc,"cursorId" desc limit $7`,
      [query.scope, query.supplier, query.dimension, query.period, query.cursorTime, query.cursorId, query.fetch]);
      return result.rows.map((row) => Object.freeze(row));
    }
    const result = await this.database.query<MetricRecord>(`select fact.metric_id code,fact.metric_version version,fact.scope_id scope,
      jsonb_build_object('from',fact.period_start,'to',fact.period_end,'timezone',fact.timezone) period,fact.dimensions,
      fact.value_numeric::float8 value,metric.unit, fact.watermark, CAST(fact.projection_version AS float8) "projectionVersion",
      fact.period_end "cursorTime",fact.metric_id||':'||md5(fact.dimensions::text) "cursorId"
      from reporting.fact fact join reporting.metric metric on metric.id=fact.metric_id and metric.version=fact.metric_version
      where fact.scope_id=$1 and ($2::text is null or fact.metric_id like $2||'.%')
        and ($3::text is null or fact.dimensions->>'application'=$3)
        and fact.period_start>=case $4 when 'yesterday' then date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone-interval '1 day'
          when '7days' then date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone-interval '6 days'
          when '30days' then date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone-interval '29 days'
          else date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone end
        and ($4<>'yesterday' or fact.period_end<=date_trunc('day',clock_timestamp() at time zone fact.timezone) at time zone fact.timezone)
        and ($5::timestamptz is null or (fact.period_end,fact.metric_id||':'||md5(fact.dimensions::text))<($5::timestamptz,$6))
      order by fact.period_end desc,"cursorId" desc limit $7`,
    [query.scope, query.dimension, query.application, query.period, query.cursorTime, query.cursorId, query.fetch]);
    return result.rows.map((row) => Object.freeze(row));
  }

  async export(id: string, scope: string): Promise<ExportJob | null> {
    const result = await this.database.query<ExportRecord>(`${exportSelect()} where job.id=$1 and job.scope_id=$2`, [id, scope]);
    return result.rows[0] ? exportJob(result.rows[0]) : null;
  }

  async exports(scope: string, report: ExportReport, fetch: number): Promise<readonly ExportJob[]> {
    const result = await this.database.query<ExportRecord>(`${exportSelect()} where job.scope_id=$1 and job.report=$2
      order by job.created_at desc limit $3`, [scope, report, fetch]);
    return result.rows.map(exportJob);
  }

  async createExport(input: Readonly<{ id: string; scope: string; report: ExportReport; filter: Readonly<Record<string, unknown>>;
    actor: string; membership: string; scopeKind: string; trace: string }>): Promise<ExportJob> {
    const authorization = JSON.stringify({ actor: input.actor, membership: input.membership, scope: input.scope, scopeKind: input.scopeKind, trace: input.trace });
    const result = await this.database.query<ExportRecord>(`insert into reporting.export(id,scope_id,report,filter,authorization_snapshot,state,cursor,record_count,
      created_at) values($1,$2,$3,$4::jsonb,$5::jsonb,'queued',null,0,clock_timestamp()) returning id,scope_id scope,report,filter,state,cursor,
      record_count "recordCount",object_ref "objectReference",sha256 "objectHash",object_size "objectSize",scan_state "scanState",
      expires_at "expiresAt",created_at "createdAt",generated_at "generatedAt",error_code "errorCode"`,
    [input.id, input.scope, input.report, JSON.stringify(input.filter), authorization]);
    await this.database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,'export','reporting',$2,jsonb_build_object('export',$3),'queued',100,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
    [`job:${input.id}`, input.scope, input.id]);
    return exportJob(required(result.rows[0], 'REPORT_EXPORT_CREATE_FAILED'));
  }

  async claimEvent(event: string): Promise<ProjectionEvent | null> {
    const result = await this.database.query<{ id: string; type: string; version: number; aggregate: string; scope: string;
      payload: Record<string, unknown>; occurredAt: string }>(`select inbox.event_id id,inbox.event_type type,inbox.event_version version,
      outbox.aggregate_id aggregate,outbox.scope_id scope,inbox.payload,outbox.occurred_at "occurredAt" from runtime.inbox inbox
      join runtime.outbox outbox on outbox.id=inbox.event_id where inbox.consumer='job:projection' and inbox.event_id=$1
      and inbox.processed_at is null for update of inbox`, [event]);
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }

  async period(occurredAt: string, timezone: string): Promise<Readonly<{ from: string; to: string }>> {
    const result = await this.database.query<{ from: string; to: string }>(`select date_trunc('day',$1::timestamptz at time zone $2) at time zone $2 "from",
      (date_trunc('day',$1::timestamptz at time zone $2)+interval '1 day') at time zone $2 "to"`, [occurredAt, timezone]);
    return required(result.rows[0], 'REPORT_PERIOD_FAILED');
  }

  async addMetrics(metrics: readonly Metric[]): Promise<void> {
    if (metrics.length === 0) return;
    const values = metrics.map((value) => ({ code: value.code, version: value.version, scope: value.scope, dimensions: value.dimensions,
      period_start: value.period.from, period_end: value.period.to, timezone: value.period.timezone, amount: value.value,
      currency: value.unit === 'minor' ? 'CNY' : null, watermark: value.watermark }));
    await this.database.query(`insert into reporting.fact(metric_id,metric_version,scope_id,dimensions,period_start,period_end,timezone,value_numeric,currency,
      watermark,projection_version) select value.code,value.version,value.scope,value.dimensions,value.period_start,value.period_end,value.timezone,
      value.amount,value.currency,value.watermark,1 from jsonb_to_recordset($1::jsonb) value(code text,version integer,scope text,dimensions jsonb,
      period_start timestamptz,period_end timestamptz,timezone text,amount numeric,currency char(3),watermark timestamptz)
      on conflict(metric_id,metric_version,scope_id,period_start,dimensions) do update set
      value_numeric=reporting.fact.value_numeric+excluded.value_numeric,watermark=greatest(reporting.fact.watermark,excluded.watermark),
      projection_version=reporting.fact.projection_version+1`, [JSON.stringify(values)]);
  }

  async createOrder(value: OrderProjection): Promise<void> {
    await this.database.query(`insert into reporting.orderprojection(order_id,scope_id,order_number,payment_state,
      fulfillment_state,aftersale_state,lifecycle_state,total_minor,currency,occurred_at,snapshot,watermark,projection_version)
      select $1,scope,$3,'unpaid','pending','none','created',$4,$5,$6,$7::jsonb,$6,1 from unnest($2::text[]) scope
      on conflict(order_id,scope_id) do nothing`, [value.order, value.scopes, value.number, value.totalMinor, value.currency, value.occurredAt,
      JSON.stringify(value.snapshot)]);
  }

  async payOrder(order: string, amountMinor: number, currency: string, snapshot: Readonly<Record<string, unknown>>, watermark: string): Promise<void> {
    const result = await this.database.query(`update reporting.orderprojection set payment_state='paid',fulfillment_state='allocated',lifecycle_state='active',
      total_minor=$2,currency=$3,snapshot=$4::jsonb,watermark=greatest(watermark,$5),projection_version=projection_version+1 where order_id=$1`,
    [order, amountMinor, currency, JSON.stringify(snapshot), watermark]);
    if (result.rowCount === 0) throw new Error('REPORT_ORDER_PROJECTION_MISSING');
  }

  async cancelOrder(order: string, watermark: string): Promise<void> {
    const result = await this.database.query(`update reporting.orderprojection set fulfillment_state='cancelled',lifecycle_state='cancelled',
      watermark=greatest(watermark,$2),projection_version=projection_version+1 where order_id=$1`, [order, watermark]);
    if (result.rowCount === 0) throw new Error('REPORT_ORDER_PROJECTION_MISSING');
  }

  async shipOrder(order: string, state: string, watermark: string): Promise<void> {
    const delivered = state === 'delivered';
    const result = await this.database.query(`update reporting.orderprojection set fulfillment_state=$2,lifecycle_state=case when $3 then 'completed' else lifecycle_state end,
      watermark=greatest(watermark,$4),projection_version=projection_version+1 where order_id=$1`, [order, delivered ? 'delivered' : 'shipped', delivered, watermark]);
    if (result.rowCount === 0) throw new Error('REPORT_ORDER_PROJECTION_MISSING');
  }

  async saveStatement(scope: string, payload: Readonly<Record<string, unknown>>, watermark: string): Promise<void> {
    await this.database.query(`insert into reporting.financeprojection(statement_id,scope_id,period_start,period_end,currency,opening_minor,debit_minor,
      credit_minor,closing_minor,state,watermark,projection_version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1)
      on conflict(statement_id) do update set state=excluded.state,watermark=greatest(reporting.financeprojection.watermark,excluded.watermark),
      projection_version=reporting.financeprojection.projection_version+1`, [text(payload.statement, 'REPORT_STATEMENT_REQUIRED'), scope,
      text(payload.periodStart, 'REPORT_PERIOD_START_REQUIRED'), text(payload.periodEnd, 'REPORT_PERIOD_END_REQUIRED'),
      text(payload.currency, 'REPORT_CURRENCY_REQUIRED'), integer(payload.openingMinor), integer(payload.debitMinor), integer(payload.creditMinor),
      integer(payload.closingMinor), text(payload.state, 'REPORT_STATEMENT_STATE_REQUIRED'), watermark]);
  }

  async completeEvent(event: ProjectionEvent, scopes: readonly string[]): Promise<readonly Readonly<{ scope: string; version: number }>[]> {
    await this.database.query(`insert into reporting.projectionevent(event_id,event_type,event_version,aggregate_id,scope_id,occurred_at,projected_at)
      values($1,$2,$3,$4,$5,$6,clock_timestamp()) on conflict(event_id) do nothing`,
    [event.id, event.type, event.version, event.aggregate, event.scope, event.occurredAt]);
    const completed = await this.database.query(`update runtime.inbox set processed_at=clock_timestamp(),attempts=attempts+1
      where consumer='job:projection' and event_id=$1 and processed_at is null`, [event.id]);
    if (completed.rowCount !== 1) throw new Error('REPORT_INBOX_LEASE_LOST');
    const offset = await this.database.query<{ scope: string; version: number }>(`insert into runtime.projectionoffset(projection,shard,offset_value,watermark,version)
      select 'commerce',scope,$2,$3,1 from unnest($1::text[]) scope on conflict(projection,shard) do update set offset_value=excluded.offset_value,
      watermark=greatest(runtime.projectionoffset.watermark,excluded.watermark),version=runtime.projectionoffset.version+1
      returning shard scope,version`, [[...new Set(scopes)], event.id, event.occurredAt]);
    if (offset.rows.length === 0) throw new Error('REPORT_PROJECTION_OFFSET_FAILED');
    return Object.freeze(offset.rows);
  }

  async claimExport(id: string): Promise<ExportJob | null> {
    const result = await this.database.query<ExportRecord>(`update reporting.export job set state='running',started_at=coalesce(started_at,clock_timestamp()),
      cursor=null,record_count=0
      where id=$1 and state in('queued','running') and (expires_at is null or expires_at>clock_timestamp()) returning id,scope_id scope,report,filter,state,
      cursor,record_count "recordCount",object_ref "objectReference",sha256 "objectHash",object_size "objectSize",scan_state "scanState",
      expires_at "expiresAt",created_at "createdAt",generated_at "generatedAt",error_code "errorCode"`, [id]);
    return result.rows[0] ? exportJob(result.rows[0]) : null;
  }

  async exportRows(id: string, report: ExportReport, filter: Readonly<Record<string, unknown>>, cursor: string | null, fetch: number): Promise<readonly ExportRow[]> {
    if (report === 'metrics') return this.metricExportRows(id, cursor, fetch);
    if (report === 'orders') {
      const values = orderExportFields(filter).map((field) => ORDER_EXPORT_SQL[field]).join(',');
      const result = await this.database.query<{ key: string; values: unknown[] }>(`select orders.id key,jsonb_build_array(${values}) values
        from reporting.export job join ordering.orderrecord orders on (
          (job.authorization_snapshot->>'scopeKind'='owner' and orders.member_id=job.scope_id)
          or (job.authorization_snapshot->>'scopeKind'='supplier' and exists(select 1 from fulfillment.fulfillmentorder where order_id=orders.id and partner_id=job.scope_id))
          or (job.authorization_snapshot->>'scopeKind'='store' and exists(select 1 from fulfillment.fulfillmentorder where order_id=orders.id and store_id=job.scope_id))
          or (coalesce(job.authorization_snapshot->>'scopeKind','mall') not in('owner','supplier','store') and (orders.mall_id=job.scope_id or exists(
            select 1 from organization.unitclosure closure where closure.ancestor_id=job.scope_id and closure.descendant_id=orders.mall_id
          )))
        ) where job.id=$1
        and ($2::text is null or orders.id>$2)
        and (not job.filter?'orderIds' or orders.id in(select jsonb_array_elements_text(job.filter->'orderIds')))
        and (not job.filter?'order' or job.filter->>'order'='' or orders.order_number=job.filter->>'order' or orders.id=job.filter->>'order')
        and (not job.filter?'mall' or job.filter->>'mall'='' or orders.mall_id=job.filter->>'mall')
        and (not job.filter?'lifecycle' or job.filter->>'lifecycle'='' or orders.lifecycle_state=job.filter->>'lifecycle')
        and (not job.filter?'payment' or job.filter->>'payment'='' or orders.payment_state=job.filter->>'payment')
        and (not job.filter?'fulfillment' or job.filter->>'fulfillment'='' or orders.fulfillment_state=job.filter->>'fulfillment')
        and (not job.filter?'placed' or job.filter->>'placed'='' or orders.created_at>=case job.filter->>'placed'
          when 'today' then date_trunc('day',clock_timestamp()) when '7days' then date_trunc('day',clock_timestamp())-interval '6 days'
          when '30days' then date_trunc('day',clock_timestamp())-interval '29 days' else '-infinity'::timestamptz end)
        and (not job.filter?'view' or job.filter->>'view'='all'
          or (job.filter->>'view'='unpaid' and orders.payment_state='unpaid')
          or (job.filter->>'view'='unshipped' and orders.fulfillment_state in('allocated','processing'))
          or (job.filter->>'view'='active' and orders.lifecycle_state='active')
          or (job.filter->>'view'='completed' and orders.lifecycle_state='completed')
          or (job.filter->>'view'='aftersale' and orders.aftersale_state<>'none')
          or (job.filter->>'view'='exception' and (orders.payment_state='failed' or orders.fulfillment_state in('cancelled','returned') or orders.aftersale_state in('requested','processing','rejected'))))
        order by orders.id limit $3`, [id, cursor, fetch]);
      return result.rows;
    }
    const result = await this.database.query<{ key: string; values: unknown[] }>(`select projection.statement_id key,jsonb_build_array(
      projection.statement_id,projection.period_start,projection.period_end,projection.currency,projection.opening_minor,projection.debit_minor,
      projection.credit_minor,projection.closing_minor,projection.state) values from reporting.export job join reporting.financeprojection projection
      on projection.scope_id=job.scope_id where job.id=$1 and ($2::text is null or projection.statement_id>$2)
      and (not job.filter?'period' or to_char(projection.period_start,'YYYY-MM')=job.filter->>'period')
      and (not job.filter?'from' or projection.period_start>=(job.filter->>'from')::date)
      and (not job.filter?'to' or projection.period_end<=(job.filter->>'to')::date) order by projection.statement_id limit $3`, [id, cursor, fetch]);
    return result.rows;
  }

  async advanceExport(id: string, cursor: string, count: number): Promise<void> {
    await this.database.query(`update reporting.export set cursor=$2,record_count=record_count+$3 where id=$1 and state='running'`, [id, cursor, count]);
  }

  async completeExport(id: string, object: Readonly<{ reference: string; sha256: string; size: number; scan: 'clean' }>): Promise<void> {
    const result = await this.database.query(`update reporting.export set state='completed',object_ref=$2,sha256=$3,object_size=$4,scan_state=$5,
      generated_at=clock_timestamp(),expires_at=clock_timestamp()+interval '24 hours' where id=$1 and state='running'`,
    [id, object.reference, object.sha256, object.size, object.scan]);
    if (result.rowCount !== 1) throw new Error('REPORT_EXPORT_STATE_CONFLICT');
  }

  async failExport(id: string, code: string, terminal: boolean): Promise<void> {
    await this.database.query(`update reporting.export set state=case when $3 then 'failed' else 'queued' end,error_code=$2,
      cursor=case when $3 then cursor else null end,record_count=case when $3 then record_count else 0 end,
      generated_at=case when $3 then clock_timestamp() else null end where id=$1 and state='running'`, [id, code, terminal]);
  }

  private async metricExportRows(id: string, cursor: string | null, fetch: number): Promise<readonly ExportRow[]> {
    const result = await this.database.query<{ key: string; values: unknown[] }>(`select to_char(fact.period_end,'YYYY-MM-DD"T"HH24:MI:SS.USOF')||':'||
      fact.metric_id||':'||md5(fact.dimensions::text) key,jsonb_build_array(fact.metric_id,fact.metric_version,fact.scope_id,fact.period_start,
      fact.period_end,fact.timezone,fact.dimensions,fact.value_numeric,metric.unit,fact.currency,fact.watermark,fact.projection_version,job.filter,job.created_at) values
      from reporting.export job join reporting.fact fact on fact.scope_id=job.scope_id join reporting.metric metric
      on metric.id=fact.metric_id and metric.version=fact.metric_version where job.id=$1
      and ($2::text is null or to_char(fact.period_end,'YYYY-MM-DD"T"HH24:MI:SS.USOF')||':'||fact.metric_id||':'||md5(fact.dimensions::text)>$2)
      and (not job.filter?'metric' or fact.metric_id like (job.filter->>'metric')||'.%')
      and (not job.filter?'application' or fact.dimensions->>'application'=job.filter->>'application')
      and (not job.filter?'from' or fact.period_start>=(job.filter->>'from')::timestamptz)
      and (not job.filter?'to' or fact.period_end<=(job.filter->>'to')::timestamptz) order by key limit $3`, [id, cursor, fetch]);
    return result.rows;
  }
}

function dashboardResult(value: Readonly<{ metrics: readonly MetricRecord[]; summary: CockpitSummary }>):
Readonly<{ rows: readonly MetricRow[]; summary: CockpitSummary }> {
  return Object.freeze({ rows: value.metrics.map((row) => Object.freeze(row)), summary: value.summary });
}

function exportSelect(): string {
  return `select job.id,job.scope_id scope,job.report,job.filter,case when job.state='completed' and job.expires_at<=clock_timestamp()
    then 'expired' else job.state end state,job.cursor,job.record_count "recordCount",job.object_ref "objectReference",job.sha256 "objectHash",
    job.object_size "objectSize",job.scan_state "scanState",job.expires_at "expiresAt",job.created_at "createdAt",job.generated_at "generatedAt",
    job.error_code "errorCode"
    from reporting.export job`;
}

function exportJob(row: ExportRecord): ExportJob { return Object.freeze(row); }
function required<T>(value: T | undefined, code: string): T { if (value === undefined) throw new Error(code); return value; }
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
function integer(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error('REPORT_INTEGER_INVALID'); return value; }

const ORDER_EXPORT_SQL: Readonly<Record<OrderExportField, string>> = Object.freeze({
  orderNumber: 'orders.order_number', createdAt: 'orders.created_at', lifecycleState: 'orders.lifecycle_state', mallId: 'orders.mall_id',
  memberId: 'orders.member_id', totalMinor: 'orders.total_minor', currency: 'orders.currency', paymentState: 'orders.payment_state',
  productNames: `(select string_agg(line.title_snapshot,'、' order by line.id) from ordering.line line where line.order_id=orders.id)`,
  skus: `(select string_agg(line.sku_id,'、' order by line.id) from ordering.line line where line.order_id=orders.id)`,
  quantityTotal: `(select coalesce(sum(line.quantity),0) from ordering.line line where line.order_id=orders.id)`,
  fulfillmentState: 'orders.fulfillment_state',
  providers: `(select string_agg(distinct line.provider,'、') from ordering.line line where line.order_id=orders.id and line.provider is not null)`,
  aftersaleState: 'orders.aftersale_state',
  refundMinor: `(select coalesce(sum(aftersale.amount_minor),0) from ordering.aftersale aftersale where aftersale.order_id=orders.id and aftersale.kind='refund' and aftersale.state in('approved','processing','completed'))`,
});
