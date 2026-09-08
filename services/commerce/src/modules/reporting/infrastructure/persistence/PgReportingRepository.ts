import type { ReportingPort } from '../../application/port/ReportingPort';
import type { ExportReport } from '../../domain/model/ExportJob';
import type { MetricContribution } from '../../domain/model/Metric';
import type { OrderProjection, ProjectionEvent } from '../../domain/model/Projection';
import { PgReportingExportRepository } from './PgReportingExportRepository';
import { integer, object, required, text, utcTime } from './ReportingRecord';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { exportFilter } from '../../domain/value/ExportFilter';

export class PgReportingRepository extends PgReportingExportRepository implements ReportingPort {
  async createRequestedExport(event: ProjectionEvent): Promise<void> {
    const payload = event.payload;
    const id = text(payload.export, 'REPORT_EXPORT_ID_REQUIRED');
    const report = text(payload.report, 'REPORT_EXPORT_TYPE_REQUIRED') as ExportReport;
    if (!['orders', 'finance.statement'].includes(report)) throw new Error('REPORT_EXPORT_TYPE_UNSUPPORTED');
    const filter = exportFilter(report, object(payload.filter, 'REPORT_FILTER_INVALID'));
    const authorization = object(payload.authorization, 'REPORT_AUTHORIZATION_SNAPSHOT_REQUIRED');
    if (text(authorization.scope, 'REPORT_AUTHORIZATION_SCOPE_REQUIRED') !== event.scope) throw new Error('REPORT_AUTHORIZATION_SCOPE_MISMATCH');
    const watermark = instant(payload.watermark, 'REPORT_EXPORT_WATERMARK_REQUIRED');
    if (Date.parse(watermark) !== Date.parse(event.occurredAt)) throw new Error('REPORT_EXPORT_WATERMARK_MISMATCH');
    await this.database.query(
      `insert into reporting.export(id,scope_id,report,filter,query_snapshot,watermark_event,watermark_at,watermark_version,
      generation_version,authorization_snapshot,state,cursor,record_count,snapshot_at,created_at)
      values($1,$2,$3,$4::jsonb,$4::jsonb,$5,$6,$7,1,$8::jsonb,'queued',null,0,$6,$6) on conflict(id) do nothing`,
      [id, event.scope, report, JSON.stringify(filter), event.id, watermark, event.version, JSON.stringify(authorization)]
    );
    await new PgRuntimeWriter(this.database).schedule({ id: `job:${id}`, kind: 'export', owner: 'reporting', scope: event.scope, payload: { export: id }, priority: 100 });
  }

  async claimEvent(event: string): Promise<ProjectionEvent | null> {
    return new PgRuntimeWriter(this.database).claim('job:projection', event);
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

  async addMetrics(metrics: readonly MetricContribution[], event: string): Promise<void> {
    if (metrics.length === 0) return;
    const values = metrics.map((value) => ({
      code: value.code,
      scope: value.scope,
      dimensions: value.dimensions,
      period_start: value.period.from,
      period_end: value.period.to,
      timezone: value.period.timezone,
      amount: value.value,
      unit: value.unit,
      currency: value.currency,
      watermark: value.watermark,
    }));
    const projected = await this.database.query<{ requested: number; valid: number; selected: number; projected: number }>(
      `with input as(
        select value.code,value.scope,value.dimensions,value.period_start,value.period_end,value.timezone,value.unit,value.currency,
          sum(value.amount) amount,max(value.watermark) watermark
        from jsonb_to_recordset($1::jsonb) value(code text,scope text,dimensions jsonb,period_start timestamptz,
          period_end timestamptz,timezone text,amount numeric,unit text,currency char(3),watermark timestamptz)
        group by value.code,value.scope,value.dimensions,value.period_start,value.period_end,value.timezone,value.unit,value.currency
      ), valid as(
        select input.code,input.scope,input.dimensions,input.period_start,input.period_end,input.timezone,input.unit,input.currency,
          input.amount,input.watermark,metric.version from input join lateral(
          select version,unit,dimensions allowed_dimensions from reporting.metric where id=input.code order by version desc limit 1
        ) metric on metric.unit=input.unit and not exists(
          select 1 from jsonb_object_keys(input.dimensions) key where not metric.allowed_dimensions?key
        )
      ), selected as(
        select valid.code,valid.scope,valid.dimensions,valid.period_start,valid.period_end,valid.timezone,valid.unit,valid.currency,
          valid.amount,valid.watermark,valid.version from valid where not exists(select 1 from reporting.factrevision revision
          where revision.event_id=$2 and revision.metric_id=valid.code and revision.metric_version=valid.version
            and revision.scope_id=valid.scope and revision.period_start=valid.period_start and revision.dimensions=valid.dimensions)
      ), periods as(
        insert into reporting.period(scope_id,period_start,period_end,timezone,state,last_event_id,last_event_at,version)
        select distinct scope,period_start,period_end,timezone,'open',$2,watermark,1 from selected
        on conflict(scope_id,period_start,timezone) do update set
          last_event_id=case when excluded.last_event_at>=reporting.period.last_event_at then excluded.last_event_id else reporting.period.last_event_id end,
          last_event_at=greatest(reporting.period.last_event_at,excluded.last_event_at),version=reporting.period.version+1
        where reporting.period.state='open' returning scope_id,period_start,timezone
      ), saved as(
        insert into reporting.fact(metric_id,metric_version,scope_id,dimensions,period_start,period_end,timezone,value_numeric,currency,
          watermark,projection_version)
        select code,version,scope,dimensions,period_start,period_end,timezone,amount,currency,watermark,1 from selected
        where exists(select 1 from periods where periods.scope_id=selected.scope and periods.period_start=selected.period_start and periods.timezone=selected.timezone)
        on conflict(metric_id,metric_version,scope_id,period_start,dimensions) do update set
          value_numeric=reporting.fact.value_numeric+excluded.value_numeric,watermark=greatest(reporting.fact.watermark,excluded.watermark),
          projection_version=reporting.fact.projection_version+1
        returning metric_id,metric_version,scope_id,dimensions,period_start,period_end,timezone,value_numeric,currency,watermark,projection_version
      ), revision as(insert into reporting.factrevision(metric_id,metric_version,scope_id,dimensions,period_start,period_end,timezone,value_numeric,currency,
        watermark,data_version,projection_version,event_id,recorded_at)
      select metric_id,metric_version,scope_id,dimensions,period_start,period_end,timezone,value_numeric,currency,watermark,
        coalesce((select version from reporting.watermark where projection='commerce' and scope_id=saved.scope_id),0)+1,
        projection_version,$2,clock_timestamp() from saved on conflict(event_id,metric_id,metric_version,scope_id,period_start,dimensions) do nothing
        returning event_id)
      select (select count(*)::integer from input) requested,(select count(*)::integer from valid) valid,
        (select count(*)::integer from selected) selected,(select count(*)::integer from revision) projected`,
      [JSON.stringify(values), event]
    );
    const outcome = required(projected.rows[0], 'REPORT_METRIC_PROJECTION_FAILED');
    if (Number(outcome.requested) !== Number(outcome.valid)) throw new Error('REPORT_METRIC_PROJECTION_REJECTED');
    if (Number(outcome.selected) !== Number(outcome.projected)) throw new Error('REPORT_PERIOD_CLOSED');
  }

  async orderApplication(order: string): Promise<string> {
    const result = await this.database.query<{ application: string | null }>(
      `select snapshot->>'application' application from reporting.orderprojection
      where order_id=$1 and snapshot->>'application' is not null order by scope_id limit 1`,
      [order]
    );
    return text(required(result.rows[0], 'REPORT_ORDER_PROJECTION_MISSING').application, 'REPORT_APPLICATION_REQUIRED');
  }

  async createOrder(value: OrderProjection): Promise<void> {
    await this.database.query(
      `insert into reporting.orderprojection(order_id,scope_id,order_number,payment_state,
      fulfillment_state,aftersale_state,lifecycle_state,total_minor,currency,occurred_at,snapshot,watermark,projection_version)
      select $1,scope,$3,coalesce($7::jsonb->>'paymentState','unpaid'),coalesce($7::jsonb->>'fulfillmentState','unallocated'),
      coalesce($7::jsonb->>'aftersaleState','none'),coalesce($7::jsonb->>'lifecycleState','awaitingpayment'),$4,$5,$6,$7::jsonb,$6,1 from unnest($2::text[]) scope
      on conflict(order_id,scope_id) do nothing`,
      [value.order, value.scopes, value.number, value.totalMinor, value.currency, value.occurredAt, JSON.stringify(value.snapshot)]
    );
    if ((await this.recordOrder(value.order, value.sourceEvent)) === 0) throw new Error('REPORT_ORDER_PROJECTION_MISSING');
  }

  async payOrder(order: string, amountMinor: number, currency: string, snapshot: Readonly<Record<string, unknown>>, watermark: string, event: string): Promise<void> {
    await this.database.query(
      `update reporting.orderprojection set payment_state='paid',fulfillment_state='allocated',lifecycle_state='paid',
      total_minor=$2,currency=$3,snapshot=$4::jsonb,watermark=$5,projection_version=projection_version+1 where order_id=$1 and watermark<=$5`,
      [order, amountMinor, currency, JSON.stringify(snapshot), watermark]
    );
    if ((await this.recordOrder(order, event)) === 0) throw new Error('REPORT_ORDER_PROJECTION_MISSING');
  }

  async cancelOrder(order: string, watermark: string, event: string): Promise<void> {
    await this.database.query(
      `update reporting.orderprojection set fulfillment_state='cancelled',lifecycle_state='cancelled',
      watermark=$2,projection_version=projection_version+1 where order_id=$1 and watermark<=$2`,
      [order, watermark]
    );
    if ((await this.recordOrder(order, event)) === 0) throw new Error('REPORT_ORDER_PROJECTION_MISSING');
  }

  async shipOrder(order: string, state: string, watermark: string, event: string): Promise<void> {
    const delivered = state === 'delivered';
    await this.database.query(
      `update reporting.orderprojection set fulfillment_state=$2,lifecycle_state=case when $3 then 'completed' else lifecycle_state end,
      watermark=$4,projection_version=projection_version+1 where order_id=$1 and watermark<=$4`,
      [order, delivered ? 'delivered' : 'shipped', delivered, watermark]
    );
    if ((await this.recordOrder(order, event)) === 0) throw new Error('REPORT_ORDER_PROJECTION_MISSING');
  }

  async saveStatement(scope: string, payload: Readonly<Record<string, unknown>>, watermark: string, event: string): Promise<void> {
    await this.database.query(
      `insert into reporting.financeprojection(statement_id,scope_id,period_start,period_end,currency,opening_minor,debit_minor,
      credit_minor,closing_minor,state,watermark,projection_version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1)
      on conflict(statement_id) do update set state=excluded.state,watermark=excluded.watermark,
      projection_version=reporting.financeprojection.projection_version+1 where reporting.financeprojection.watermark<=excluded.watermark`,
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
    const revision = await this.database.query(
      `insert into reporting.financerevision(statement_id,scope_id,period_start,period_end,currency,opening_minor,debit_minor,
      credit_minor,closing_minor,state,watermark,data_version,projection_version,event_id,recorded_at)
      select statement_id,scope_id,period_start,period_end,currency,opening_minor,debit_minor,credit_minor,closing_minor,state,
        watermark,coalesce((select version from reporting.watermark where projection='commerce' and scope_id=reporting.financeprojection.scope_id),0)+1,
        projection_version,$2,clock_timestamp() from reporting.financeprojection where statement_id=$1
      on conflict(event_id,statement_id) do nothing`,
      [text(payload.statement, 'REPORT_STATEMENT_REQUIRED'), event]
    );
    if (revision.rowCount !== 1) throw new Error('REPORT_FINANCE_PROJECTION_MISSING');
  }

  private async recordOrder(order: string, event: string): Promise<number> {
    const revision = await this.database.query(
      `insert into reporting.orderrevision(order_id,scope_id,order_number,payment_state,fulfillment_state,aftersale_state,
      lifecycle_state,total_minor,currency,occurred_at,snapshot,watermark,data_version,projection_version,event_id,recorded_at)
      select order_id,scope_id,order_number,payment_state,fulfillment_state,aftersale_state,lifecycle_state,total_minor,currency,
        occurred_at,snapshot,watermark,coalesce((select version from reporting.watermark where projection='commerce' and scope_id=reporting.orderprojection.scope_id),0)+1,
        projection_version,$2,clock_timestamp() from reporting.orderprojection where order_id=$1
      on conflict(event_id,order_id,scope_id) do nothing`,
      [order, event]
    );
    return revision.rowCount ?? 0;
  }

  async completeEvent(event: ProjectionEvent, scopes: readonly string[]): Promise<readonly Readonly<{ scope: string; version: number }>[]> {
    await this.database.query(
      `insert into reporting.projectionevent(event_id,event_type,event_version,aggregate_id,scope_id,payload,occurred_at,projected_at)
      values($1,$2,$3,$4,$5,$6::jsonb,$7,clock_timestamp()) on conflict(event_id) do nothing`,
      [event.id, event.type, event.version, event.aggregate, event.scope, JSON.stringify(event.payload), event.occurredAt]
    );
    const offset = await new PgRuntimeWriter(this.database).completeProjection('job:projection', event, scopes);
    await this.database.query(
      `insert into reporting.watermark(projection,scope_id,event_id,occurred_at,version,advanced_at)
      select 'commerce',scope,$2,$3,1,clock_timestamp() from unnest($1::text[]) scope
      on conflict(projection,scope_id) do update set
        event_id=case when excluded.occurred_at>=reporting.watermark.occurred_at then excluded.event_id else reporting.watermark.event_id end,
        occurred_at=greatest(reporting.watermark.occurred_at,excluded.occurred_at),version=reporting.watermark.version+1,
        advanced_at=clock_timestamp()`,
      [[...new Set(scopes)], event.id, event.occurredAt]
    );
    return offset;
  }
}

function instant(value: unknown, code: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error(code);
  return value;
}
