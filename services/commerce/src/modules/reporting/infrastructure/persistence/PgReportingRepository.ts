import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { ReportingPort } from '../../application/port/ReportingPort';
import type { ExportJob, ExportReport } from '../../domain/model/ExportJob';
import type { CockpitSummary, Metric, MetricQuery, MetricRow } from '../../domain/model/Metric';
import type { OrderProjection, ProjectionEvent } from '../../domain/model/Projection';
import { PgReportingExportRepository } from './PgReportingExportRepository';
import { cockpitSummary, exportJob, exportSelect, integer, metricRow, object, required, text, utcTime, type ExportRecord, type MetricRecord } from './ReportingRecord';

export class PgReportingRepository extends PgReportingExportRepository implements ReportingPort {
  async cockpit(scope: string): Promise<CockpitSummary> {
    const result = await this.database.query<{ summary: CockpitSummary }>('select reporting.cockpit($1) summary', [scope]);
    return cockpitSummary(required(result.rows[0], 'REPORT_COCKPIT_FAILED').summary);
  }

  async metrics(query: MetricQuery): Promise<readonly MetricRow[]> {
    const result = await this.database.query<MetricRecord>(
      `select fact.metric_id code,fact.metric_version version,fact.scope_id scope,
      jsonb_build_object('from',fact.period_start,'to',fact.period_end,'timezone',fact.timezone) period,fact.dimensions,
      fact.value_numeric::float8 value,metric.unit, fact.watermark, fact.projection_version "projectionVersion",
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
      [query.scope, query.dimension, query.application, query.period, query.cursorTime, query.cursorId, query.fetch]
    );
    return result.rows.map(metricRow);
  }

  async export(id: string, scope: string): Promise<ExportJob | null> {
    const result = await this.database.query<ExportRecord>(`${exportSelect()} where job.id=$1 and job.scope_id=$2`, [id, scope]);
    return result.rows[0] ? exportJob(result.rows[0]) : null;
  }

  async createExport(input: Readonly<{ id: string; scope: string; report: ExportReport; filter: Readonly<Record<string, unknown>>; actor: string; membership: string; trace: string }>): Promise<ExportJob> {
    const authorization = JSON.stringify({ actor: input.actor, membership: input.membership, scope: input.scope, trace: input.trace });
    const result = await this.database.query<ExportRecord>(
      `insert into reporting.export(id,scope_id,report,filter,authorization_snapshot,state,cursor,record_count,
      created_at) values($1,$2,$3,$4::jsonb,$5::jsonb,'queued',null,0,clock_timestamp()) returning id,scope_id scope,report,filter,state,cursor,
      record_count "recordCount",object_ref "objectReference",sha256 "objectHash",object_size "objectSize",scan_state "scanState",
      expires_at "expiresAt",created_at "createdAt",generated_at "generatedAt"`,
      [input.id, input.scope, input.report, JSON.stringify(input.filter), authorization]
    );
    await this.database.query(
      `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,'export','reporting',$2,jsonb_build_object('export',$3),'queued',100,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
      [`job:${input.id}`, input.scope, input.id]
    );
    return exportJob(required(result.rows[0], 'REPORT_EXPORT_CREATE_FAILED'));
  }

  async createRequestedExport(event: ProjectionEvent): Promise<void> {
    const payload = event.payload;
    const id = text(payload.export, 'REPORT_EXPORT_ID_REQUIRED');
    const report = text(payload.report, 'REPORT_EXPORT_TYPE_REQUIRED') as ExportReport;
    if (!['orders', 'finance.statement'].includes(report)) throw new Error('REPORT_EXPORT_TYPE_UNSUPPORTED');
    const filter = object(payload.filter, 'REPORT_FILTER_INVALID');
    const authorization = object(payload.authorization, 'REPORT_AUTHORIZATION_SNAPSHOT_REQUIRED');
    if (text(authorization.scope, 'REPORT_AUTHORIZATION_SCOPE_REQUIRED') !== event.scope) throw new Error('REPORT_AUTHORIZATION_SCOPE_MISMATCH');
    await this.database.query(
      `insert into reporting.export(id,scope_id,report,filter,authorization_snapshot,state,cursor,record_count,created_at)
      values($1,$2,$3,$4::jsonb,$5::jsonb,'queued',null,0,$6) on conflict(id) do nothing`,
      [id, event.scope, report, JSON.stringify(filter), JSON.stringify(authorization), event.occurredAt]
    );
    await this.database.query(
      `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,'export','reporting',$2,jsonb_build_object('export',$3),'queued',100,clock_timestamp(),clock_timestamp(),clock_timestamp())
      on conflict(id) do nothing`,
      [`job:${id}`, event.scope, id]
    );
  }

  async claimEvent(event: string): Promise<ProjectionEvent | null> {
    const result = await this.database.query<{ id: string; type: string; version: number; aggregate: string; scope: string; payload: Record<string, unknown>; occurredAt: string }>(
      `select inbox.event_id id,inbox.event_type type,inbox.event_version version,
      outbox.aggregate_id aggregate,outbox.scope_id scope,inbox.payload,outbox.occurred_at "occurredAt" from runtime.inbox inbox
      join runtime.outbox outbox on outbox.id=inbox.event_id where inbox.consumer='job:projection' and inbox.event_id=$1
      and inbox.processed_at is null for update of inbox`,
      [event]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }

  async period(occurredAt: string, timezone: string): Promise<Readonly<{ from: string; to: string }>> {
    const result = await this.database.query<{ from: string; to: string }>(
      `select date_trunc('day',$1::timestamptz at time zone $2) at time zone $2 "from",
      (date_trunc('day',$1::timestamptz at time zone $2)+interval '1 day') at time zone $2 "to"`,
      [occurredAt, timezone]
    );
    const period = required(result.rows[0], 'REPORT_PERIOD_FAILED');
    return Object.freeze({ from: utcTime(period.from), to: utcTime(period.to) });
  }

  async addMetrics(metrics: readonly Metric[]): Promise<void> {
    if (metrics.length === 0) return;
    const values = metrics.map((value) => ({
      code: value.code,
      version: value.version,
      scope: value.scope,
      dimensions: value.dimensions,
      period_start: value.period.from,
      period_end: value.period.to,
      timezone: value.period.timezone,
      amount: value.value,
      currency: value.unit === 'minor' ? 'CNY' : null,
      watermark: value.watermark,
    }));
    await this.database.query(
      `insert into reporting.fact(metric_id,metric_version,scope_id,dimensions,period_start,period_end,timezone,value_numeric,currency,
      watermark,projection_version) select value.code,value.version,value.scope,value.dimensions,value.period_start,value.period_end,value.timezone,
      value.amount,value.currency,value.watermark,1 from jsonb_to_recordset($1::jsonb) value(code text,version integer,scope text,dimensions jsonb,
      period_start timestamptz,period_end timestamptz,timezone text,amount numeric,currency char(3),watermark timestamptz)
      on conflict(metric_id,metric_version,scope_id,period_start,dimensions) do update set
      value_numeric=reporting.fact.value_numeric+excluded.value_numeric,watermark=greatest(reporting.fact.watermark,excluded.watermark),
      projection_version=reporting.fact.projection_version+1`,
      [JSON.stringify(values)]
    );
  }

  async createOrder(value: OrderProjection): Promise<void> {
    await this.database.query(
      `insert into reporting.orderprojection(order_id,scope_id,order_number,payment_state,
      fulfillment_state,aftersale_state,lifecycle_state,total_minor,currency,occurred_at,snapshot,watermark,projection_version)
      select $1,scope,$3,'unpaid','pending','none','created',$4,$5,$6,$7::jsonb,$6,1 from unnest($2::text[]) scope
      on conflict(order_id,scope_id) do nothing`,
      [value.order, value.scopes, value.number, value.totalMinor, value.currency, value.occurredAt, JSON.stringify(value.snapshot)]
    );
  }

  async payOrder(order: string, amountMinor: number, currency: string, snapshot: Readonly<Record<string, unknown>>, watermark: string): Promise<void> {
    const result = await this.database.query(
      `update reporting.orderprojection set payment_state='paid',fulfillment_state='allocated',lifecycle_state='active',
      total_minor=$2,currency=$3,snapshot=$4::jsonb,watermark=greatest(watermark,$5),projection_version=projection_version+1 where order_id=$1`,
      [order, amountMinor, currency, JSON.stringify(snapshot), watermark]
    );
    if (result.rowCount === 0) throw new Error('REPORT_ORDER_PROJECTION_MISSING');
  }

  async cancelOrder(order: string, watermark: string): Promise<void> {
    const result = await this.database.query(
      `update reporting.orderprojection set fulfillment_state='cancelled',lifecycle_state='cancelled',
      watermark=greatest(watermark,$2),projection_version=projection_version+1 where order_id=$1`,
      [order, watermark]
    );
    if (result.rowCount === 0) throw new Error('REPORT_ORDER_PROJECTION_MISSING');
  }

  async shipOrder(order: string, state: string, watermark: string): Promise<void> {
    const delivered = state === 'delivered';
    const result = await this.database.query(
      `update reporting.orderprojection set fulfillment_state=$2,lifecycle_state=case when $3 then 'completed' else lifecycle_state end,
      watermark=greatest(watermark,$4),projection_version=projection_version+1 where order_id=$1`,
      [order, delivered ? 'delivered' : 'shipped', delivered, watermark]
    );
    if (result.rowCount === 0) throw new Error('REPORT_ORDER_PROJECTION_MISSING');
  }

  async saveStatement(scope: string, payload: Readonly<Record<string, unknown>>, watermark: string): Promise<void> {
    await this.database.query(
      `insert into reporting.financeprojection(statement_id,scope_id,period_start,period_end,currency,opening_minor,debit_minor,
      credit_minor,closing_minor,state,watermark,projection_version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1)
      on conflict(statement_id) do update set state=excluded.state,watermark=greatest(reporting.financeprojection.watermark,excluded.watermark),
      projection_version=reporting.financeprojection.projection_version+1`,
      [
        text(payload.statement, 'REPORT_STATEMENT_REQUIRED'),
        scope,
        text(payload.periodStart, 'REPORT_PERIOD_START_REQUIRED'),
        text(payload.periodEnd, 'REPORT_PERIOD_END_REQUIRED'),
        text(payload.currency, 'REPORT_CURRENCY_REQUIRED'),
        integer(payload.openingMinor),
        integer(payload.debitMinor),
        integer(payload.creditMinor),
        integer(payload.closingMinor),
        text(payload.state, 'REPORT_STATEMENT_STATE_REQUIRED'),
        watermark,
      ]
    );
  }

  async completeEvent(event: ProjectionEvent, scopes: readonly string[]): Promise<readonly Readonly<{ scope: string; version: number }>[]> {
    await this.database.query(
      `insert into reporting.projectionevent(event_id,event_type,event_version,aggregate_id,scope_id,occurred_at,projected_at)
      values($1,$2,$3,$4,$5,$6,clock_timestamp()) on conflict(event_id) do nothing`,
      [event.id, event.type, event.version, event.aggregate, event.scope, event.occurredAt]
    );
    const completed = await this.database.query(
      `update runtime.inbox set processed_at=clock_timestamp(),attempts=attempts+1
      where consumer='job:projection' and event_id=$1 and processed_at is null`,
      [event.id]
    );
    if (completed.rowCount !== 1) throw new Error('REPORT_INBOX_LEASE_LOST');
    const offset = await this.database.query<{ scope: string; version: number }>(
      `insert into runtime.projectionoffset(projection,shard,offset_value,watermark,version)
      select 'commerce',scope,$2,$3,1 from unnest($1::text[]) scope on conflict(projection,shard) do update set offset_value=excluded.offset_value,
      watermark=greatest(runtime.projectionoffset.watermark,excluded.watermark),version=runtime.projectionoffset.version+1
      returning shard scope,version`,
      [[...new Set(scopes)], event.id, event.occurredAt]
    );
    if (offset.rows.length === 0) throw new Error('REPORT_PROJECTION_OFFSET_FAILED');
    await this.database.query(
      `insert into reporting.watermark(projection,scope_id,event_id,occurred_at,version,advanced_at)
      select 'commerce',scope,$2,$3,1,clock_timestamp() from unnest($1::text[]) scope
      on conflict(projection,scope_id) do update set
        event_id=case when excluded.occurred_at>=reporting.watermark.occurred_at then excluded.event_id else reporting.watermark.event_id end,
        occurred_at=greatest(reporting.watermark.occurred_at,excluded.occurred_at),version=reporting.watermark.version+1,
        advanced_at=clock_timestamp()`,
      [[...new Set(scopes)], event.id, event.occurredAt]
    );
    return Object.freeze(offset.rows);
  }
}
