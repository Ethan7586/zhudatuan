import { type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ExportJob, ExportReport, ExportRow } from '../../domain/model/ExportJob';
import { exportJob, type ExportRecord } from './ReportingRecord';

export class PgReportingExportRepository {
  constructor(protected readonly database: SqlExecutor) {}
  async claimExport(id: string): Promise<ExportJob | null> {
    const result = await this.database.query<ExportRecord>(
      `update reporting.export job set state='running',started_at=coalesce(started_at,clock_timestamp()),
      cursor=null,record_count=0
      where id=$1 and state in('queued','running') and (expires_at is null or expires_at>clock_timestamp()) returning id,scope_id scope,report,filter,state,
      cursor,record_count "recordCount",object_ref "objectReference",sha256 "objectHash",object_size "objectSize",scan_state "scanState",
      expires_at "expiresAt",created_at "createdAt",generated_at "generatedAt",
      jsonb_build_object('filter',query_snapshot,'watermark',jsonb_build_object('event',watermark_event,
        'occurredAt',watermark_at,'version',watermark_version),'generatedAt',snapshot_at,'generationVersion',generation_version) snapshot`,
      [id]
    );
    return result.rows[0] ? exportJob(result.rows[0]) : null;
  }

  async exportRows(id: string, report: ExportReport, cursor: string | null, fetch: number): Promise<readonly ExportRow[]> {
    if (report === 'metrics') return this.metricExportRows(id, cursor, fetch);
    if (report === 'orders') {
      const result = await this.database.query<{ key: string; values: unknown[] }>(
        `select projection.order_id key,jsonb_build_array(projection.order_number,projection.snapshot->>'externalOrderNo',
        projection.snapshot->>'sourceChannel',projection.payment_state,projection.fulfillment_state,projection.aftersale_state,
        projection.lifecycle_state,coalesce(projection.snapshot->>'verificationState','verified'),projection.total_minor,
        projection.currency,coalesce(nullif(projection.snapshot->>'orderedAt','')::timestamptz,projection.occurred_at),job.watermark_at) values
        from reporting.export job join lateral(
          select distinct on(revision.order_id) revision.* from reporting.orderrevision revision
          where revision.scope_id=job.scope_id and revision.watermark<=job.watermark_at and revision.data_version<=job.watermark_version
          order by revision.order_id,revision.projection_version desc
        ) projection on true
        where job.id=$1 and ($2::text is null or projection.order_id>$2)
        and (not job.filter?'search' or projection.order_number=job.filter->>'search' or projection.snapshot->>'externalOrderNo'=job.filter->>'search')
        and (not job.filter?'view' or case job.filter->>'view'
          when 'unpaid' then projection.payment_state in('unpaid','authorizing')
          when 'unshipped' then projection.payment_state in('paid','partially_refunded') and projection.fulfillment_state in('unallocated','allocated')
          when 'active' then projection.lifecycle_state<>'cancelled' and projection.fulfillment_state in('processing','shipped','delivered')
          when 'completed' then projection.lifecycle_state='completed'
          when 'exception' then projection.payment_state='failed' or projection.lifecycle_state='cancelled' or projection.fulfillment_state in('cancelled','returned')
          else false end)
        and (not job.filter?'placed' or coalesce(nullif(projection.snapshot->>'orderedAt','')::timestamptz,projection.occurred_at)>=case job.filter->>'placed'
          when 'today' then date_trunc('day',job.created_at at time zone coalesce(job.filter->>'timezone','UTC')) at time zone coalesce(job.filter->>'timezone','UTC')
          when '7days' then job.created_at-interval '7 days' when '30days' then job.created_at-interval '30 days' else '-infinity'::timestamptz end)
        and (not job.filter?'from' or coalesce(nullif(projection.snapshot->>'orderedAt','')::timestamptz,projection.occurred_at)>=(job.filter->>'from')::timestamptz)
        and (not job.filter?'to' or coalesce(nullif(projection.snapshot->>'orderedAt','')::timestamptz,projection.occurred_at)<(job.filter->>'to')::timestamptz)
        and (not job.filter?'lifecycle' or projection.lifecycle_state=job.filter->>'lifecycle')
        and (not job.filter?'payment' or projection.payment_state=job.filter->>'payment')
        and (not job.filter?'fulfillment' or projection.fulfillment_state=job.filter->>'fulfillment')
        and (not job.filter?'mall' or projection.snapshot->>'mall'=job.filter->>'mall')
        and (not job.filter?'channel' or projection.snapshot->>'sourceChannel'=job.filter->>'channel' or exists(
          select 1 from jsonb_array_elements(coalesce(projection.snapshot->'lines','[]'::jsonb)) item(value) where item.value->>'provider'=job.filter->>'channel'))
        and (not job.filter?'product' or exists(select 1 from jsonb_array_elements(coalesce(projection.snapshot->'lines','[]'::jsonb)) item(value)
          where item.value->>'product'=job.filter->>'product' or item.value->>'sku'=job.filter->>'product' or item.value->>'category'=job.filter->>'product'))
        and (not job.filter?'memberIds' or projection.snapshot->>'member' in(select jsonb_array_elements_text(job.filter->'memberIds')))
        and (not job.filter?'minimumMinor' or projection.total_minor>=(job.filter->>'minimumMinor')::bigint)
        and (not job.filter?'maximumMinor' or projection.total_minor<=(job.filter->>'maximumMinor')::bigint)
        order by projection.order_id limit $3`,
        [id, cursor, fetch]
      );
      return result.rows;
    }
    const result = await this.database.query<{ key: string; values: unknown[] }>(
      `select projection.statement_id key,jsonb_build_array(
      projection.statement_id,projection.period_start,projection.period_end,projection.currency,projection.opening_minor,projection.debit_minor,
      projection.credit_minor,projection.closing_minor,projection.state) values from reporting.export job join lateral(
        select distinct on(revision.statement_id) revision.* from reporting.financerevision revision
        where revision.scope_id=job.scope_id and revision.watermark<=job.watermark_at and revision.data_version<=job.watermark_version
        order by revision.statement_id,revision.projection_version desc
      ) projection on true where job.id=$1 and ($2::text is null or projection.statement_id>$2)
      and (not job.filter?'periodStart' or projection.period_start>=(job.filter->>'periodStart')::date)
      and (not job.filter?'periodEnd' or projection.period_end<=(job.filter->>'periodEnd')::date)
      and (not job.filter?'currency' or projection.currency=job.filter->>'currency')
      and (not job.filter?'state' or projection.state=job.filter->>'state') order by projection.statement_id limit $3`,
      [id, cursor, fetch]
    );
    return result.rows;
  }

  async exportCount(id: string, report: ExportReport): Promise<number | null> {
    if (report !== 'metrics') return null;
    const result = await this.database.query<{ count: number }>('select count(*)::integer count from reporting.metricexportrows($1)', [id]);
    const count = Number(result.rows[0]?.count);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('REPORT_EXPORT_COUNT_INVALID');
    return count;
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
      `select key,rowvalues values from reporting.metricexportrows($1)
      where ($2::text is null or key>$2) order by key limit $3`,
      [id, cursor, fetch]
    );
    return result.rows;
  }
}
