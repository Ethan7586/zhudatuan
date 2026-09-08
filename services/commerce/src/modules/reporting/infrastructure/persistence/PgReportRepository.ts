import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ReportRepository } from '../../application/port/ReportRepository';
import type { ExportJob } from '../../domain/model/ExportJob';
import type { CockpitProduct, CockpitQuery, CockpitSummary, MetricQuery, MetricRow } from '../../domain/model/Metric';
import type { DataWatermark } from '../../domain/model/ReportSnapshot';
import { cockpitSummary, exportJob, exportSelect, metricRow, required, utcTime, type ExportRecord, type MetricRecord } from './ReportingRecord';
export class PgReportRepository implements ReportRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async metrics(context: ReadTransactionContext, query: MetricQuery): Promise<readonly MetricRow[]> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<MetricRecord>(
      `with fact as(
        select distinct on(metric_id,metric_version,scope_id,period_start,dimensions)
          metric_id,metric_version,scope_id,dimensions,period_start,period_end,timezone,value_numeric,currency,watermark,
          data_version,projection_version,event_id,recorded_at
        from reporting.factrevision
        where scope_id=$1 and watermark<=$5 and data_version<=$6
        order by metric_id,metric_version,scope_id,period_start,dimensions,projection_version desc
      ) select fact.metric_id code,fact.metric_version version,fact.scope_id scope,
      jsonb_build_object('name',metric.name,'formula',metric.formula,'dimensions',metric.dimensions,
        'granularity',metric.granularity,'owner',metric.owner) definition,
      jsonb_build_object('from',fact.period_start,'to',fact.period_end,'timezone',fact.timezone) period,fact.dimensions,
      fact.value_numeric::float8 value,metric.unit,fact.currency,fact.watermark,fact.projection_version "projectionVersion",
      fact.period_end "cursorTime",fact.metric_id||':'||md5(fact.dimensions::text) "cursorId"
      from fact join reporting.metric metric on metric.id=fact.metric_id and metric.version=fact.metric_version
      where ($2::text is null or fact.metric_id like $2||'.%')
        and ($3::text is null or fact.dimensions->>'application'=$3)
        and fact.period_start>=case $4 when 'yesterday' then date_trunc('day',$7::timestamptz at time zone fact.timezone) at time zone fact.timezone-interval '1 day'
          when '7days' then date_trunc('day',$7::timestamptz at time zone fact.timezone) at time zone fact.timezone-interval '6 days'
          when '30days' then date_trunc('day',$7::timestamptz at time zone fact.timezone) at time zone fact.timezone-interval '29 days'
          else date_trunc('day',$7::timestamptz at time zone fact.timezone) at time zone fact.timezone end
        and ($4<>'yesterday' or fact.period_end<=date_trunc('day',$7::timestamptz at time zone fact.timezone) at time zone fact.timezone)
        and ($8::timestamptz is null or (fact.period_end,fact.metric_id||':'||md5(fact.dimensions::text))<($8::timestamptz,$9))
      order by fact.period_end desc,"cursorId" desc limit $10`,
      [query.scope, query.dimension, query.application, query.period, query.watermarkAt, query.watermarkVersion, query.snapshotAt, query.cursorTime, query.cursorId, query.fetch]
    );
    return Object.freeze(result.rows.map(metricRow));
  }
  async watermark(context: ReadTransactionContext, scope: string): Promise<DataWatermark> {
    const result = await this.transactions.database(context).query<{ event: string; occurredAt: string | Date; version: number }>(
      `with current as(select event_id event,occurred_at "occurredAt",version from reporting.watermark
        where projection='commerce' and scope_id=$1)
      select event,"occurredAt",version from current union all
      select 'reporting:empty',coalesce((select max(watermark) from reporting.fact where scope_id=$1),statement_timestamp()),1
      where not exists(select 1 from current) limit 1`,
      [scope]
    );
    const row = required(result.rows[0], 'REPORT_WATERMARK_MISSING');
    return Object.freeze({ event: row.event, occurredAt: utcTime(row.occurredAt), version: Number(row.version) });
  }
  async cockpit(context: ReadTransactionContext, query: CockpitQuery): Promise<CockpitSummary> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<
      {
        summary: CockpitSummary;
        products: readonly CockpitProduct[];
      } & Record<string, unknown>
    >('select reporting.cockpit($1,$2,$3,$4,$5,$6) summary,reporting.cockpitproducts($1,$2,$3,$4,$5,$6) products', [query.scope, query.period, query.application, query.watermarkAt, query.watermarkVersion, query.snapshotAt]);
    const row = required(result.rows[0], 'REPORT_COCKPIT_FAILED');
    return cockpitSummary(row.summary, row.products);
  }
  async export(context: ReadTransactionContext, id: string, scope: string): Promise<ExportJob | null> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<ExportRecord>(`${exportSelect()} where job.id=$1 and job.scope_id=$2`, [id, scope]);
    return result.rows[0] ? exportJob(result.rows[0]) : null;
  }
  async createExport(context: WriteTransactionContext, input: Parameters<ReportRepository['createExport']>[1]): Promise<ExportJob> {
    const database = this.transactions.database(context);
    const authorization = JSON.stringify({ actor: input.actor, membership: input.membership, scope: input.scope, trace: input.trace });
    const result = await this.transactions.database(context).query<ExportRecord>(
      `insert into reporting.export(id,scope_id,report,filter,query_snapshot,watermark_event,watermark_at,watermark_version,generation_version,
      authorization_snapshot,state,cursor,record_count,snapshot_at,created_at)
      values($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10::jsonb,'queued',null,0,$11,clock_timestamp())
      returning id,scope_id scope,report,filter,state,cursor,record_count "recordCount",object_ref "objectReference",sha256 "objectHash",
        object_size "objectSize",scan_state "scanState",expires_at "expiresAt",created_at "createdAt",generated_at "generatedAt",
        jsonb_build_object('filter',query_snapshot,'watermark',jsonb_build_object('event',watermark_event,
          'occurredAt',watermark_at,'version',watermark_version),'generatedAt',snapshot_at,'generationVersion',generation_version) snapshot`,
      [
        input.id,
        input.scope,
        input.report,
        JSON.stringify(input.filter),
        JSON.stringify(input.snapshot.filter),
        input.snapshot.watermark.event,
        input.snapshot.watermark.occurredAt,
        input.snapshot.watermark.version,
        input.snapshot.generationVersion,
        authorization,
        input.snapshot.generatedAt,
      ]
    );
    return exportJob(required(result.rows[0], 'REPORT_EXPORT_CREATE_FAILED'));
  }
}
