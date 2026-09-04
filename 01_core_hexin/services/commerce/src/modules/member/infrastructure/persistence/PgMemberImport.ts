import type { PoolClient } from 'pg';
import type { BatchImportPort, ImportTarget } from '../../../../foundation/application/BatchImport';
import { importCode, importDetail, type ImportFailure } from '../../../../foundation/infrastructure/ImportFile';
import type { StoredObject } from '../../../../foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { configureWorker, workerTransaction } from '../../../../foundation/infrastructure/WorkerDatabase';
import type { IdentityPrincipal } from '../../../identity';
import { accessPort } from '../../../access/AccessModule';
import { importMember } from '../../application/MemberProfileImport';

interface TargetRow { readonly id: string; readonly organization_id: string; readonly object_ref: string; readonly sha256: string; readonly state: ImportTarget['state'] }
interface StagedRow { readonly row_number: number; readonly payload: Readonly<Record<string, string>> }

export class PgMemberImport implements BatchImportPort {
  constructor(private readonly pool: DatabasePool, private readonly identities: IdentityPrincipal) {}

  async find(id: string): Promise<ImportTarget | null> {
    const result = await this.pool.query<TargetRow>('select id,organization_id,object_ref,sha256,state from member.importjob where id=$1', [id]);
    const row = result.rows[0];
    return row ? { id: row.id, scope: row.organization_id, reference: row.object_ref, sha256: row.sha256, state: row.state } : null;
  }

  async stage(target: ImportTarget, rows: readonly Readonly<Record<string, string>>[]): Promise<void> {
    await workerTransaction(this.pool, target.scope, async (client) => {
      await client.query("update member.importjob set state='validating',last_error=null,updated_at=clock_timestamp() where id=$1", [target.id]);
      await client.query('delete from member.importrow where job_id=$1', [target.id]);
      await client.query('delete from member.importerror where job_id=$1', [target.id]);
    });
    for (let offset = 0; offset < rows.length; offset += 500) {
      const batch = rows.slice(offset, offset + 500).map((payload, index) => ({ row_number: offset + index + 2, payload }));
      await workerTransaction(this.pool, target.scope, async (client) => {
        await client.query(`insert into member.importrow(job_id,organization_id,row_number,payload)
          select $1,$2,item.row_number,item.payload from jsonb_to_recordset($3::jsonb) item(row_number integer,payload jsonb)`,
        [target.id, target.scope, JSON.stringify(batch)]);
      });
    }
    await workerTransaction(this.pool, target.scope, async (client) => {
      await client.query(`update member.importjob set state='ready',total_count=$2,cursor_value=0,success_count=0,failure_count=0,
        validation_summary=jsonb_build_object('format','csv','rows',$2,'columns',$3::jsonb,'shardSize',500),updated_at=clock_timestamp() where id=$1`,
      [target.id, rows.length, JSON.stringify(Object.keys(rows[0]!).sort())]);
    });
  }

  async process(target: ImportTarget, signal: AbortSignal): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('begin'); await configureWorker(client, target.scope);
      const job = await client.query<{ cursor_value: number; total_count: number }>(`select cursor_value,total_count from member.importjob
        where id=$1 and state in('ready','running') for update`, [target.id]);
      if (!job.rows[0]) { await client.query('commit'); return true; }
      const staged = await client.query<StagedRow>(`select row_number,payload from member.importrow where job_id=$1 and row_number>$2
        order by row_number limit 500`, [target.id, job.rows[0].cursor_value + 1]);
      if (staged.rows.length === 0 && job.rows[0].cursor_value < job.rows[0].total_count) throw new Error('MEMBER_IMPORT_STAGE_INCOMPLETE');
      let successes = 0; let failures = 0;
      for (const row of staged.rows) {
        if (signal.aborted) throw signal.reason;
        await client.query('savepoint importrow');
        try { await importMember(client, this.identities, accessPort, target.scope, row.payload); successes += 1; }
        catch (cause) {
          await client.query('rollback to savepoint importrow'); failures += 1;
          await client.query(`insert into member.importerror(job_id,row_number,reason_code,field,detail) values($1,$2,$3,null,$4)
            on conflict(job_id,row_number,reason_code) do update set detail=excluded.detail`,
          [target.id, row.row_number, importCode(cause, 'MEMBER_IMPORT_ROW_FAILED'), importDetail(cause)]);
        }
        await client.query('release savepoint importrow');
      }
      const cursor = staged.rows.at(-1)?.row_number ? staged.rows.at(-1)!.row_number - 1 : job.rows[0].cursor_value;
      const more = cursor < job.rows[0].total_count;
      await client.query(`update member.importjob set state=$2,cursor_value=$3,success_count=success_count+$4,failure_count=failure_count+$5,
        validation_summary=validation_summary||jsonb_build_object('processed',$3,'errors',failure_count+$5),last_error=null,updated_at=clock_timestamp() where id=$1`,
      [target.id, more ? 'running' : 'reporting', cursor, successes, failures]);
      if (more) await continuation(client, target, cursor);
      await client.query('commit'); return !more;
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  async failures(target: ImportTarget): Promise<readonly ImportFailure[]> {
    const result = await this.pool.query<{ row_number: number; reason_code: string; field: string | null; detail: string }>(
      'select row_number,reason_code,field,detail from member.importerror where job_id=$1 order by row_number,reason_code', [target.id]);
    return result.rows.map((row) => ({ row: row.row_number, reason: row.reason_code, field: row.field, detail: row.detail }));
  }
  async complete(target: ImportTarget, report: StoredObject): Promise<void> {
    const client = await this.pool.connect();
    try { await client.query('begin'); await configureWorker(client, target.scope);
      await client.query(`update member.importjob set state='completed',report_object_ref=$2,report_sha256=$3,report_size=$4,
        last_error=null,updated_at=clock_timestamp() where id=$1 and state='reporting'`, [target.id, report.reference, report.sha256, report.size]);
      await client.query('delete from member.importrow where job_id=$1', [target.id]); await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }
  async reject(target: ImportTarget, code: string, detail: string): Promise<void> {
    await this.pool.query(`update member.importjob set state='failed',last_error=$2,
      validation_summary=validation_summary||jsonb_build_object('code',$3),updated_at=clock_timestamp() where id=$1`, [target.id, detail, code]);
  }
  async fault(target: ImportTarget, detail: string): Promise<void> {
    await this.pool.query('update member.importjob set last_error=$2,updated_at=clock_timestamp() where id=$1', [target.id, detail]);
  }
}

async function continuation(client: PoolClient, target: ImportTarget, cursor: number): Promise<void> {
  await client.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values($1,'memberimport','member',$2,jsonb_build_object('import',$3),'queued',100,clock_timestamp(),clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
  [`job:${target.id}:${cursor}`, target.scope, target.id]);
}
