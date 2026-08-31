import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { ExportJob, ExportReport, ExportRow } from '../../domain/model/ExportJob';
import { exportJob, type ExportRecord } from './ReportingRecord';

export class PgReportingExportRepository {
  constructor(protected readonly database: OperationDatabase) {}
  async claimExport(id: string): Promise<ExportJob | null> {
    const result = await this.database.query<ExportRecord>(
      `update reporting.export job set state='running',started_at=coalesce(started_at,clock_timestamp()),
      cursor=null,record_count=0
      where id=$1 and state in('queued','running') and (expires_at is null or expires_at>clock_timestamp()) returning id,scope_id scope,report,filter,state,
      cursor,record_count "recordCount",object_ref "objectReference",sha256 "objectHash",object_size "objectSize",scan_state "scanState",
      expires_at "expiresAt",created_at "createdAt",generated_at "generatedAt"`,
      [id]
    );
    return result.rows[0] ? exportJob(result.rows[0]) : null;
  }

  async exportRows(id: string, report: ExportReport, cursor: string | null, fetch: number): Promise<readonly ExportRow[]> {
    if (report === 'metrics') return this.metricExportRows(id, cursor, fetch);
    if (report === 'orders') {
      const result = await this.database.query<{ key: string; values: unknown[] }>(
        `select projection.order_id key,jsonb_build_array(projection.order_id,
        projection.order_number,projection.payment_state,projection.fulfillment_state,projection.aftersale_state,projection.total_minor,
        projection.currency,projection.occurred_at) values from reporting.export job join reporting.orderprojection projection
        on projection.scope_id=job.scope_id where job.id=$1 and ($2::text is null or projection.order_id>$2)
        and (not job.filter?'paymentState' or projection.payment_state=job.filter->>'paymentState')
        and (not job.filter?'period' or projection.occurred_at>=case job.filter->>'period'
          when 'yesterday' then date_trunc('day',clock_timestamp())-interval '1 day'
          when '7days' then date_trunc('day',clock_timestamp())-interval '6 days'
          when '30days' then date_trunc('day',clock_timestamp())-interval '29 days' else '-infinity'::timestamptz end)
        and (not job.filter?'from' or projection.occurred_at>=(job.filter->>'from')::timestamptz)
        and (not job.filter?'to' or projection.occurred_at<(job.filter->>'to')::timestamptz)
        order by projection.order_id limit $3`,
        [id, cursor, fetch]
      );
      return result.rows;
    }
    const result = await this.database.query<{ key: string; values: unknown[] }>(
      `select projection.statement_id key,jsonb_build_array(
      projection.statement_id,projection.period_start,projection.period_end,projection.currency,projection.opening_minor,projection.debit_minor,
      projection.credit_minor,projection.closing_minor,projection.state) values from reporting.export job join reporting.financeprojection projection
      on projection.scope_id=job.scope_id where job.id=$1 and ($2::text is null or projection.statement_id>$2)
      and (not job.filter?'period' or to_char(projection.period_start,'YYYY-MM')=job.filter->>'period')
      and (not job.filter?'from' or projection.period_start>=(job.filter->>'from')::date)
      and (not job.filter?'to' or projection.period_end<=(job.filter->>'to')::date) order by projection.statement_id limit $3`,
      [id, cursor, fetch]
    );
    return result.rows;
  }

  async advanceExport(id: string, cursor: string, count: number): Promise<void> {
    await this.database.query(`update reporting.export set cursor=$2,record_count=record_count+$3 where id=$1 and state='running'`, [id, cursor, count]);
  }

  async completeExport(id: string, object: Readonly<{ reference: string; sha256: string; size: number; scan: 'clean' }>): Promise<void> {
    const result = await this.database.query(
      `update reporting.export set state='completed',object_ref=$2,sha256=$3,object_size=$4,scan_state=$5,
      generated_at=clock_timestamp(),expires_at=clock_timestamp()+interval '24 hours' where id=$1 and state='running'`,
      [id, object.reference, object.sha256, object.size, object.scan]
    );
    if (result.rowCount !== 1) throw new Error('REPORT_EXPORT_STATE_CONFLICT');
  }

  async failExport(id: string, code: string, terminal: boolean): Promise<void> {
    await this.database.query(
      `update reporting.export set state=case when $3 then 'failed' else 'queued' end,error_code=$2,
      cursor=case when $3 then cursor else null end,record_count=case when $3 then record_count else 0 end,
      generated_at=case when $3 then clock_timestamp() else null end where id=$1 and state='running'`,
      [id, code, terminal]
    );
  }

  private async metricExportRows(id: string, cursor: string | null, fetch: number): Promise<readonly ExportRow[]> {
    const result = await this.database.query<{ key: string; values: unknown[] }>(
      `select to_char(fact.period_end,'YYYY-MM-DD"T"HH24:MI:SS.USOF')||':'||
      fact.metric_id||':'||md5(fact.dimensions::text) key,jsonb_build_array(fact.metric_id,fact.metric_version,fact.scope_id,fact.period_start,
      fact.period_end,fact.timezone,fact.dimensions,fact.value_numeric,metric.unit,fact.currency,fact.watermark,fact.projection_version,job.filter,job.created_at) values
      from reporting.export job join reporting.fact fact on fact.scope_id=job.scope_id join reporting.metric metric
      on metric.id=fact.metric_id and metric.version=fact.metric_version where job.id=$1
      and ($2::text is null or to_char(fact.period_end,'YYYY-MM-DD"T"HH24:MI:SS.USOF')||':'||fact.metric_id||':'||md5(fact.dimensions::text)>$2)
      and (not job.filter?'metric' or fact.metric_id like (job.filter->>'metric')||'.%')
      and (not job.filter?'application' or fact.dimensions->>'application'=job.filter->>'application')
      and (not job.filter?'from' or fact.period_start>=(job.filter->>'from')::timestamptz)
      and (not job.filter?'to' or fact.period_end<=(job.filter->>'to')::timestamptz) order by key limit $3`,
      [id, cursor, fetch]
    );
    return result.rows;
  }
}
