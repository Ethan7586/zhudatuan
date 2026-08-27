import type { PoolClient } from 'pg';
import type { BatchImportPort, ImportTarget } from '../../../../foundation/application/BatchImport';
import { importCode, importDetail, type ImportFailure } from '../../../../foundation/infrastructure/ImportFile';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { StoredObject } from '../../../../foundation/infrastructure/ObjectStore';
import { mapParallel } from '../../../../foundation/performance/Parallel';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { configureWorker } from '../../../../foundation/infrastructure/WorkerDatabase';

interface TargetRow { readonly id: string; readonly scope_id: string; readonly object_ref: string; readonly sha256: string; readonly state: ImportTarget['state'] }
interface CardRow { readonly row: number; readonly code: string }
interface StagedRow { readonly row_number: number; readonly code_ciphertext: string | null; readonly code_fingerprint: string | null;
  readonly code_key_version: string | null; readonly error_code: string | null }

export class PgVoucherImport implements BatchImportPort {
  constructor(private readonly pool: DatabasePool, private readonly kms: KmsClient) {}

  async find(id: string): Promise<ImportTarget | null> {
    const result = await this.pool.query<TargetRow>('select id,scope_id,object_ref,sha256,state from voucher.importjob where id=$1', [id]);
    const row = result.rows[0];
    return row ? { id: row.id, scope: row.scope_id, reference: row.object_ref, sha256: row.sha256, state: row.state } : null;
  }

  async stage(target: ImportTarget, rows: readonly Readonly<Record<string, string>>[]): Promise<void> {
    await this.reset(target);
    const seen = new Set<string>();
    for (let offset = 0; offset < rows.length; offset += 500) {
      const prepared = rows.slice(offset, offset + 500).map((row, index) => card(row, offset + index + 2, seen));
      const encrypted = await mapParallel(prepared, 16, async (item) => item.code === null ? { ...item, envelope: null } : ({ ...item,
        envelope: await this.kms.encrypt('voucher/code', item.code, { cardpool: target.id, row: String(item.row) }) }));
      const client = await this.pool.connect();
      try {
        await client.query('begin'); await configureWorker(client, target.scope);
        await client.query(`insert into voucher.importrow(job_id,scope_id,row_number,code_ciphertext,code_fingerprint,code_key_version,error_code)
          select $1,$2,item.row_number,item.code_ciphertext,item.code_fingerprint,item.code_key_version,item.error_code
          from jsonb_to_recordset($3::jsonb) item(row_number integer,code_ciphertext text,code_fingerprint text,code_key_version text,error_code text)`,
        [target.id, target.scope, JSON.stringify(encrypted.map((item) => ({ row_number: item.row, code_ciphertext: item.envelope?.ciphertext ?? null,
          code_fingerprint: item.envelope?.fingerprint ?? null, code_key_version: item.envelope?.keyVersion ?? null, error_code: item.error })))]);
        await client.query('commit');
      } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
    }
    await this.pool.query(`update voucher.importjob set state='ready',total_count=$2,cursor_value=0,success_count=0,failure_count=0,
      validation_summary=jsonb_build_object('format','csv','rows',$2,'columns',$3::jsonb,'shardSize',500,'encryptedStaging',true),updated_at=clock_timestamp() where id=$1`,
    [target.id, rows.length, JSON.stringify(Object.keys(rows[0]!).sort())]);
  }

  async process(target: ImportTarget, signal: AbortSignal): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('begin'); await configureWorker(client, target.scope);
      const job = await client.query<{ cursor_value: number; total_count: number; cardpool_id: string }>(`select cursor_value,total_count,cardpool_id
        from voucher.importjob where id=$1 and state in('ready','running') for update`, [target.id]);
      if (!job.rows[0]) { await client.query('commit'); return true; }
      const staged = await client.query<StagedRow>(`select row_number,code_ciphertext,code_fingerprint,code_key_version,error_code
        from voucher.importrow where job_id=$1 and row_number>$2 order by row_number limit 500`, [target.id, job.rows[0].cursor_value + 1]);
      if (staged.rows.length === 0 && job.rows[0].cursor_value < job.rows[0].total_count) throw new Error('VOUCHER_IMPORT_STAGE_INCOMPLETE');
      let successes = 0; let failures = 0;
      for (const row of staged.rows) {
        if (signal.aborted) throw signal.reason;
        await client.query('savepoint importrow');
        try {
          if (row.error_code) throw new Error(row.error_code);
          const saved = await client.query(`insert into voucher.card(id,cardpool_id,code_ciphertext,code_fingerprint,code_key_version,state,version)
            values($1,$2,$3,$4,$5,'available',0) on conflict(code_fingerprint) do nothing returning id`,
          [`card:${row.code_fingerprint}`, job.rows[0].cardpool_id, row.code_ciphertext, row.code_fingerprint, row.code_key_version]);
          if (!saved.rows[0]) throw new Error('VOUCHER_CARD_DUPLICATE');
          successes += 1;
        } catch (cause) {
          await client.query('rollback to savepoint importrow'); failures += 1;
          await client.query(`insert into voucher.importerror(job_id,row_number,reason_code,field,detail) values($1,$2,$3,'code',$4)
            on conflict(job_id,row_number) do update set reason_code=excluded.reason_code,field=excluded.field,detail=excluded.detail`,
          [target.id, row.row_number, importCode(cause, 'VOUCHER_CARD_IMPORT_FAILED'), importDetail(cause)]);
        }
        await client.query('release savepoint importrow');
      }
      const cursor = staged.rows.at(-1)?.row_number ? staged.rows.at(-1)!.row_number - 1 : job.rows[0].cursor_value;
      const more = cursor < job.rows[0].total_count;
      await client.query(`update voucher.importjob set state=$2,cursor_value=$3,success_count=success_count+$4,failure_count=failure_count+$5,
        validation_summary=validation_summary||jsonb_build_object('processed',$3,'errors',failure_count+$5),last_error=null,updated_at=clock_timestamp() where id=$1`,
      [target.id, more ? 'running' : 'reporting', cursor, successes, failures]);
      if (more) await continuation(client, target, cursor);
      await client.query('commit'); return !more;
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  async failures(target: ImportTarget): Promise<readonly ImportFailure[]> {
    const result = await this.pool.query<{ row_number: number; reason_code: string; field: string | null; detail: string }>(
      'select row_number,reason_code,field,detail from voucher.importerror where job_id=$1 order by row_number', [target.id]);
    return result.rows.map((row) => ({ row: row.row_number, reason: row.reason_code, field: row.field, detail: row.detail }));
  }
  async complete(target: ImportTarget, report: StoredObject): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin'); await configureWorker(client, target.scope);
      await client.query(`with completed as (update voucher.importjob set state='completed',report_object_ref=$2,report_sha256=$3,report_size=$4,
        last_error=null,updated_at=clock_timestamp() where id=$1 and state='reporting' returning cardpool_id)
        update voucher.cardpool pool set status=case when exists(select 1 from voucher.card where cardpool_id=pool.id) then 'ready' else 'disabled' end,
        version=version+1 from completed where pool.id=completed.cardpool_id`, [target.id, report.reference, report.sha256, report.size]);
      await client.query('delete from voucher.importrow where job_id=$1', [target.id]); await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }
  async reject(target: ImportTarget, code: string, detail: string): Promise<void> {
    await this.pool.query(`with failed as (update voucher.importjob set state='failed',last_error=$2,
      validation_summary=validation_summary||jsonb_build_object('code',$3),updated_at=clock_timestamp() where id=$1 returning cardpool_id)
      update voucher.cardpool pool set status='disabled',version=version+1 from failed where pool.id=failed.cardpool_id`, [target.id, detail, code]);
  }
  async fault(target: ImportTarget, detail: string): Promise<void> {
    await this.pool.query('update voucher.importjob set last_error=$2,updated_at=clock_timestamp() where id=$1', [target.id, detail]);
  }

  private async reset(target: ImportTarget): Promise<void> {
    const client = await this.pool.connect();
    try { await client.query('begin'); await configureWorker(client, target.scope);
      await client.query("update voucher.importjob set state='validating',last_error=null,updated_at=clock_timestamp() where id=$1", [target.id]);
      await client.query('delete from voucher.importrow where job_id=$1', [target.id]);
      await client.query('delete from voucher.importerror where job_id=$1', [target.id]); await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }
}

function card(row: Readonly<Record<string, string>>, number: number, seen: Set<string>): Readonly<{ row: number; code: string | null; error: string | null }> {
  const code = row.code?.trim() ?? '';
  if (!/^[A-Za-z0-9-]{8,128}$/.test(code)) return { row: number, code: null, error: 'VOUCHER_CARD_FORMAT_INVALID' };
  if (seen.has(code)) return { row: number, code: null, error: 'VOUCHER_CARD_DUPLICATE_FILE' };
  seen.add(code); return { row: number, code, error: null };
}
async function continuation(client: PoolClient, target: ImportTarget, cursor: number): Promise<void> {
  await client.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values($1,'voucherimport','voucher',$2,jsonb_build_object('import',$3),'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
  [`job:${target.id}:${cursor}`, target.scope, target.id]);
}
