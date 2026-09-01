import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CatalogImportRecord, CatalogImportRepository } from '../../application/port/CatalogImportRepository';
interface ImportRow extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly report_object_ref: string | null;
  readonly report_sha256: string | null;
  readonly report_size: number | string | null;
}
export class PgCatalogImportRepository implements CatalogImportRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async create(context: WriteTransactionContext, input: Parameters<CatalogImportRepository['create']>[1]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `insert into catalog.importjob(id,scope_id,object_ref,sha256,state,created_at,updated_at)
      values($1,$2,$3,$4,'uploaded',clock_timestamp(),clock_timestamp()) returning id,state,total_count,cursor_value,success_count,failure_count,created_at,updated_at`,
      [input.id, input.scope, input.reference, input.sha256]
    );
    const row = result.rows[0];
    if (!row) throw new Error('CATALOG_IMPORT_CREATE_FAILED');
    return Object.freeze({ ...row });
  }
  async read(context: ReadTransactionContext, id: string, scope: string): Promise<CatalogImportRecord | null> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<ImportRow>(
      `select job.id,job.state,job.total_count,job.cursor_value,job.success_count,job.failure_count,
      job.validation_summary,job.last_error,job.report_object_ref,job.report_sha256,job.report_size,job.created_at,job.updated_at,
      coalesce((select jsonb_agg(row_to_json(errorrow) order by errorrow.row_number,errorrow.reason_code) from
        (select row_number,reason_code,field,detail from catalog.importerror where job_id=job.id order by row_number,reason_code limit 100) errorrow),'[]'::jsonb) errors
      from catalog.importjob job where job.id=$1 and job.scope_id=$2`,
      [id, scope]
    );
    const row = result.rows[0];
    if (!row) return null;
    return Object.freeze({
      ...row,
      reportObjectRef: row.report_object_ref,
      reportSha256: row.report_sha256,
      reportSize: row.report_size === null ? null : Number(row.report_size),
    });
  }
}
