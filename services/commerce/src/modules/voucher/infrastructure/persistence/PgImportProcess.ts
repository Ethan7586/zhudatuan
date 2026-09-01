import type { ImportExecution, ImportFailure, ImportTarget } from '../../../../foundation/application/BatchImport';
import { importCode, importDetail } from '../../../../foundation/infrastructure/ImportFile';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { StoredObject } from '../../../../foundation/infrastructure/ObjectStore';
import { mapParallel } from '../../../../foundation/performance/Parallel';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';

interface TargetRow {
  readonly id: string;
  readonly scope_id: string;
  readonly object_ref: string;
  readonly sha256: string;
  readonly state: ImportTarget['state'];
}
interface CardRow {
  readonly row: number;
  readonly code: string;
}
interface StagedRow {
  readonly row_number: number;
  readonly code_ciphertext: string | null;
  readonly code_fingerprint: string | null;
  readonly code_key_version: string | null;
  readonly error_code: string | null;
}

import type { ImportProcessPort } from '../../application/port/ImportProcessPort';

export class PgImportProcess implements ImportProcessPort {
  private readonly transactions = new PgTransactionAccess();
  constructor(
    private readonly manager: TransactionManager,
    private readonly kms: KmsClient
  ) {}

  async find(id: string, execution: ImportExecution): Promise<ImportTarget | null> {
    const result = await this.manager.read(options({ id, scope: execution.scope }, execution.signal, execution.deadline), (context) =>
      this.transactions.database(context).query<TargetRow>('select id,scope_id,object_ref,sha256,state from voucher.importjob where id=$1', [id])
    );
    const row = result.rows[0];
    return row ? { id: row.id, scope: row.scope_id, reference: row.object_ref, sha256: row.sha256, state: row.state } : null;
  }

  async stage(target: ImportTarget, rows: readonly Readonly<Record<string, string>>[], execution: ImportExecution): Promise<void> {
    await this.reset(target, execution);
    const transaction = options(target, execution.signal, execution.deadline);
    const seen = new Set<string>();
    for (let offset = 0; offset < rows.length; offset += 500) {
      const prepared = rows.slice(offset, offset + 500).map((row, index) => card(row, offset + index + 2, seen));
      const encrypted = await mapParallel(prepared, 16, async (item) =>
        item.code === null ? { ...item, envelope: null } : { ...item, envelope: await this.kms.encrypt('pii', 'voucher/code', item.code, { cardpool: target.id, row: String(item.row) }) }
      );
      await this.manager.write(transaction, async (context) => {
        await this.transactions.database(context).query(
          `insert into voucher.importrow(job_id,scope_id,row_number,code_ciphertext,code_fingerprint,code_key_version,error_code)
          select $1,$2,item.row_number,item.code_ciphertext,item.code_fingerprint,item.code_key_version,item.error_code
          from jsonb_to_recordset($3::jsonb) item(row_number integer,code_ciphertext text,code_fingerprint text,code_key_version text,error_code text)`,
          [
            target.id,
            target.scope,
            JSON.stringify(
              encrypted.map((item) => ({
                row_number: item.row,
                code_ciphertext: item.envelope?.ciphertext ?? null,
                code_fingerprint: item.envelope?.fingerprint ?? null,
                code_key_version: item.envelope?.keyVersion ?? null,
                error_code: item.error,
              }))
            ),
          ]
        );
      });
    }
    await this.manager.write(transaction, (context) =>
      this.transactions
        .database(context)
        .query(
          `update voucher.importjob set state='ready',total_count=$2,cursor_value=0,success_count=0,failure_count=0,
      validation_summary=jsonb_build_object('format','csv','rows',$2,'columns',$3::jsonb,'shardSize',500,'encryptedStaging',true),updated_at=clock_timestamp() where id=$1`,
          [target.id, rows.length, JSON.stringify(Object.keys(rows[0]!).sort())]
        )
        .then(() => undefined)
    );
  }

  async process(target: ImportTarget, signal: AbortSignal, deadline: number): Promise<boolean> {
    const transaction = options(target, signal, deadline);
    const selected = await this.manager.read(transaction, async (context) => {
      const database = this.transactions.database(context);
      const job = await database.query<{ cursor_value: number; total_count: number; cardpool_id: string }>(
        `select cursor_value,total_count,cardpool_id
        from voucher.importjob where id=$1 and state in('ready','running')`,
        [target.id]
      );
      if (!job.rows[0]) return null;
      const staged = await database.query<StagedRow>(
        `select row_number,code_ciphertext,code_fingerprint,code_key_version,error_code
        from voucher.importrow where job_id=$1 and row_number>$2 order by row_number limit 500`,
        [target.id, job.rows[0].cursor_value + 1]
      );
      if (staged.rows.length === 0 && job.rows[0].cursor_value < job.rows[0].total_count) throw new Error('VOUCHER_IMPORT_STAGE_INCOMPLETE');
      return Object.freeze({ cursor: job.rows[0].cursor_value, total: job.rows[0].total_count, cardpool: job.rows[0].cardpool_id, rows: Object.freeze(staged.rows) });
    });
    if (!selected) return true;
    let successes = 0;
    let failures = 0;
    for (const row of selected.rows) {
      if (signal.aborted) throw signal.reason;
      try {
        await this.manager.write(transaction, async (context) => {
          if (row.error_code) throw new Error(row.error_code);
          const saved = await this.transactions.database(context).query(
            `insert into voucher.card(id,cardpool_id,code_ciphertext,code_fingerprint,code_key_version,state,version)
            values($1,$2,$3,$4,$5,'available',0) on conflict(code_fingerprint) do nothing returning id`,
            [`card:${row.code_fingerprint}`, selected.cardpool, row.code_ciphertext, row.code_fingerprint, row.code_key_version]
          );
          if (!saved.rows[0]) throw new Error('VOUCHER_CARD_DUPLICATE');
        });
        successes += 1;
      } catch (cause) {
        failures += 1;
        await this.manager.write(transaction, (context) =>
          this.transactions
            .database(context)
            .query(
              `insert into voucher.importerror(job_id,row_number,reason_code,field,detail) values($1,$2,$3,'code',$4)
          on conflict(job_id,row_number) do update set reason_code=excluded.reason_code,field=excluded.field,detail=excluded.detail`,
              [target.id, row.row_number, importCode(cause, 'VOUCHER_CARD_IMPORT_FAILED'), importDetail(cause)]
            )
            .then(() => undefined)
        );
      }
    }
    const cursor = selected.rows.at(-1)?.row_number ? selected.rows.at(-1)!.row_number - 1 : selected.cursor;
    const more = cursor < selected.total;
    await this.manager.write(transaction, async (context) => {
      const database = this.transactions.database(context);
      await database.query(
        `update voucher.importjob set state=$2,cursor_value=$3,success_count=success_count+$4,failure_count=failure_count+$5,
        validation_summary=validation_summary||jsonb_build_object('processed',$3,'errors',failure_count+$5),last_error=null,updated_at=clock_timestamp() where id=$1`,
        [target.id, more ? 'running' : 'reporting', cursor, successes, failures]
      );
      if (more) await continuation(database, target, cursor);
    });
    return !more;
  }

  async failures(target: ImportTarget, execution: ImportExecution): Promise<readonly ImportFailure[]> {
    const result = await this.manager.read(options(target, execution.signal, execution.deadline), (context) =>
      this.transactions
        .database(context)
        .query<{ row_number: number; reason_code: string; field: string | null; detail: string }>('select row_number,reason_code,field,detail from voucher.importerror where job_id=$1 order by row_number', [target.id])
    );
    return result.rows.map((row) => ({ row: row.row_number, reason: row.reason_code, field: row.field, detail: row.detail }));
  }
  async complete(target: ImportTarget, report: StoredObject, execution: ImportExecution): Promise<void> {
    await this.manager.write(options(target, execution.signal, execution.deadline), async (context) => {
      const database = this.transactions.database(context);
      await database.query(
        `with completed as (update voucher.importjob set state='completed',report_object_ref=$2,report_sha256=$3,report_size=$4,
        last_error=null,updated_at=clock_timestamp() where id=$1 and state='reporting' returning cardpool_id)
        update voucher.cardpool pool set status=case when exists(select 1 from voucher.card where cardpool_id=pool.id) then 'ready' else 'disabled' end,
        version=version+1 from completed where pool.id=completed.cardpool_id`,
        [target.id, report.reference, report.sha256, report.size]
      );
      await database.query('delete from voucher.importrow where job_id=$1', [target.id]);
    });
  }
  async reject(target: ImportTarget, code: string, detail: string, execution: ImportExecution): Promise<void> {
    await this.manager.write(options(target, execution.signal, execution.deadline), (context) =>
      this.transactions
        .database(context)
        .query(
          `with failed as (update voucher.importjob set state='failed',last_error=$2,
      validation_summary=validation_summary||jsonb_build_object('code',$3),updated_at=clock_timestamp() where id=$1 returning cardpool_id)
      update voucher.cardpool pool set status='disabled',version=version+1 from failed where pool.id=failed.cardpool_id`,
          [target.id, detail, code]
        )
        .then(() => undefined)
    );
  }
  async fault(target: ImportTarget, detail: string, execution: ImportExecution): Promise<void> {
    await this.manager.write(options(target, execution.signal, execution.deadline), (context) =>
      this.transactions
        .database(context)
        .query('update voucher.importjob set last_error=$2,updated_at=clock_timestamp() where id=$1', [target.id, detail])
        .then(() => undefined)
    );
  }

  private async reset(target: ImportTarget, execution: ImportExecution): Promise<void> {
    await this.manager.write(options(target, execution.signal, execution.deadline), async (context) => {
      const database = this.transactions.database(context);
      await database.query("update voucher.importjob set state='validating',last_error=null,updated_at=clock_timestamp() where id=$1", [target.id]);
      await database.query('delete from voucher.importrow where job_id=$1', [target.id]);
      await database.query('delete from voucher.importerror where job_id=$1', [target.id]);
    });
  }
}

function card(row: Readonly<Record<string, string>>, number: number, seen: Set<string>): Readonly<{ row: number; code: string | null; error: string | null }> {
  const code = row.code?.trim() ?? '';
  if (!/^[A-Za-z0-9-]{8,128}$/.test(code)) return { row: number, code: null, error: 'VOUCHER_CARD_FORMAT_INVALID' };
  if (seen.has(code)) return { row: number, code: null, error: 'VOUCHER_CARD_DUPLICATE_FILE' };
  seen.add(code);
  return { row: number, code, error: null };
}
async function continuation(client: SqlExecutor, target: ImportTarget, cursor: number): Promise<void> {
  await new PgRuntimeWriter(client).schedule({ id: `job:${target.id}:${cursor}`, kind: 'voucherimport', owner: 'voucher', scope: target.scope, payload: { import: target.id }, priority: 20 });
}

function options(target: Pick<ImportTarget, 'id' | 'scope'>, signal: AbortSignal, deadline: number) {
  return { tenant: target.scope, membership: '', scope: target.scope, actor: 'job:voucherimport', trace: target.id, operation: 'job.voucher.import', workload: 'jobs' as const, signal, deadline };
}
