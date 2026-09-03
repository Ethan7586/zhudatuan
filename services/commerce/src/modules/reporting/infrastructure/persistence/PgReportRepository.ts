import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ReportRepository } from '../../application/port/ReportRepository';
import type { ExportJob } from '../../domain/model/ExportJob';
import type { CockpitSummary, MetricQuery, MetricRow, ReportPeriod } from '../../domain/model/Metric';
import { cockpitSummary, exportJob, exportSelect, metricRow, required, type ExportRecord, type MetricRecord } from './ReportingRecord';
export class PgReportRepository implements ReportRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async metrics(context: ReadTransactionContext, query: MetricQuery): Promise<readonly MetricRow[]> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<MetricRecord>(
      `select fact.metric_id code,fact.metric_version version,fact.scope_id scope,
      jsonb_build_object('from',fact.period_start,'to',fact.period_end,'timezone',fact.timezone) period,fact.dimensions,
      fact.value_numeric::float8 value,metric.unit,fact.watermark,fact.projection_version "projectionVersion",
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
    return Object.freeze(result.rows.map(metricRow));
  }
  async cockpit(context: ReadTransactionContext, scope: string, period: ReportPeriod, application: string | null): Promise<CockpitSummary> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<
      {
        summary: CockpitSummary;
      } & Record<string, unknown>
    >('select reporting.cockpit($1,$2,$3) summary', [scope, period, application]);
    return cockpitSummary(required(result.rows[0], 'REPORT_COCKPIT_FAILED').summary);
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
      `insert into reporting.export(id,scope_id,report,filter,authorization_snapshot,state,cursor,record_count,created_at)
      values($1,$2,$3,$4::jsonb,$5::jsonb,'queued',null,0,clock_timestamp())
      returning id,scope_id scope,report,filter,state,cursor,record_count "recordCount",object_ref "objectReference",sha256 "objectHash",
        object_size "objectSize",scan_state "scanState",expires_at "expiresAt",created_at "createdAt",generated_at "generatedAt"`,
      [input.id, input.scope, input.report, JSON.stringify(input.filter), authorization]
    );
    return exportJob(required(result.rows[0], 'REPORT_EXPORT_CREATE_FAILED'));
  }
}
