import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ImportFailure } from '../../public/ImportProcess';

export class PgImportEvidence {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async read(context: ReadTransactionContext, id: string, owner: string): Promise<readonly ImportFailure[]> {
    const result = await this.transactions.database(context).query<{ row_number: number; reason_code: string; field: string | null; detail: unknown }>(
      `select failure.row_number,failure.reason_code,failure.field,failure.detail from runtime.import_errors failure
       join runtime.imports target on target.id=failure.import_id where failure.import_id=$1 and target.scope_id=$2 and target.owner=$3
       order by failure.row_number,failure.reason_code`, [id, context.scope, owner]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ row: row.row_number, reason: row.reason_code, field: row.field,
      detail: typeof row.detail === 'string' ? row.detail : JSON.stringify(row.detail) })));
  }

  async store(context: WriteTransactionContext, id: string, owner: string, failures: readonly ImportFailure[]): Promise<void> {
    await this.transactions.database(context).query(
      `insert into runtime.import_errors(import_id,scope_id,row_number,reason_code,field,detail)
       select $1,target.scope_id,item.row,item.reason,item.field,to_jsonb(item.detail) from runtime.imports target,
       jsonb_to_recordset($2::jsonb) item(row integer,reason text,field text,detail text)
       where target.id=$1 and target.scope_id=$3 and target.owner=$4
       on conflict(import_id,row_number,reason_code) do update set field=excluded.field,detail=excluded.detail`,
      [id, JSON.stringify(failures), context.scope, owner]
    );
  }

  async attach(context: WriteTransactionContext, id: string, owner: string, report: Readonly<{ reference: string; sha256: string; size: number }>): Promise<void> {
    if (!report.reference || !/^[0-9a-f]{64}$/.test(report.sha256) || !Number.isSafeInteger(report.size) || report.size < 0) {
      throw new Error('RUNTIME_IMPORT_REPORT_INVALID');
    }
    const result = await this.transactions.database(context).query(
      `update runtime.imports set error_report_key=$2,checkpoint=checkpoint||jsonb_build_object('reportSha256',$3::text,'reportSize',$4::bigint),
       version=version+case when error_report_key=$2 and checkpoint->>'reportSha256'=$3 and checkpoint->>'reportSize'=$4::text then 0 else 1 end,
       updated_at=case when error_report_key=$2 and checkpoint->>'reportSha256'=$3 and checkpoint->>'reportSize'=$4::text then updated_at else clock_timestamp() end,
       updated_by='job:import' where id=$1 and scope_id=$5 and owner=$6 and state='ready' and not(checkpoint ? 'confirmedAt')
       and exists(select 1 from runtime.import_errors failure where failure.import_id=runtime.imports.id)`,
      [id, report.reference, report.sha256, report.size, context.scope, owner]
    );
    if (result.rowCount !== 1) throw new Error('RUNTIME_IMPORT_REPORT_CONFLICT');
  }
}
