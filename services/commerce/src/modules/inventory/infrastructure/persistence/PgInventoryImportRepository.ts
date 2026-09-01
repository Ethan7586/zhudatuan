import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ContractJsonValue } from '@shop/contract';
import type { InventoryImportRecord, InventoryImportRepository } from '../../application/port/InventoryImportRepository';
interface InventoryImportRow extends Record<string, unknown> {
  readonly id: string;
  readonly state: string;
  readonly total_count: number;
  readonly cursor_value: number;
  readonly success_count: number;
  readonly failure_count: number;
  readonly validation_summary: ContractJsonValue;
  readonly last_error: string | null;
  readonly report_object_ref: string | null;
  readonly report_sha256: string | null;
  readonly report_size: number | null;
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly errors: readonly Readonly<{
    row_number: number;
    reason_code: string;
    field: string | null;
    detail: ContractJsonValue;
  }>[];
}
export class PgInventoryImportRepository implements InventoryImportRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async create(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      scope: string;
      reference: string;
      sha256: string;
    }>
  ): Promise<InventoryImportRecord> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<InventoryImportRow>(
      `insert into inventory.importjob(id,scope_id,object_ref,sha256,state,created_at,updated_at)
      values($1,$2,$3,$4,'uploaded',clock_timestamp(),clock_timestamp())
      returning id,state,total_count,cursor_value,success_count,failure_count,'{}'::jsonb validation_summary,null::text last_error,
        null::text report_object_ref,null::text report_sha256,null::integer report_size,created_at,updated_at,'[]'::jsonb errors`,
      [input.id, input.scope, input.reference, input.sha256]
    );
    return map(required(result.rows[0], 'INVENTORY_IMPORT_CREATE_FAILED'));
  }
  async read(context: ReadTransactionContext, id: string, scope: string): Promise<InventoryImportRecord | null> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<InventoryImportRow>(
      `select job.id,job.state,job.total_count,job.cursor_value,job.success_count,job.failure_count,
      job.validation_summary,job.last_error,job.report_object_ref,job.report_sha256,job.report_size,job.created_at,job.updated_at,
      coalesce((select jsonb_agg(row_to_json(errorrow) order by errorrow.row_number,errorrow.reason_code) from
        (select row_number,reason_code,field,detail from inventory.importerror where job_id=job.id order by row_number,reason_code limit 100) errorrow),'[]'::jsonb) errors
      from inventory.importjob job where job.id=$1 and job.scope_id=$2`,
      [id, scope]
    );
    const row = result.rows[0];
    return row ? map(row) : null;
  }
}
function map(row: InventoryImportRow): InventoryImportRecord {
  return Object.freeze({ ...row, errors: Object.freeze([...row.errors]), created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString() });
}
function required<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return value;
}
