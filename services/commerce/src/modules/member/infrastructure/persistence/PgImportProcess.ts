import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { ImportExecution, ImportFailure, ImportTarget } from '../../../../foundation/application/BatchImport';
import { importCode, importDetail } from '../../../../foundation/infrastructure/ImportFile';
import type { StoredObject } from '../../../../foundation/infrastructure/ObjectStore';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { IdentityPrincipal } from '../../../identity/public/index';
import type { MemberAccessPort, MemberImportAccessPort } from '../../../access/public/index';
import { importMember } from '../../application/service/MemberProfileImport';
import { MemberPort } from './MemberPort';

interface TargetRow {
  readonly id: string;
  readonly organization_id: string;
  readonly object_ref: string;
  readonly sha256: string;
  readonly state: ImportTarget['state'];
}
interface StagedRow {
  readonly row_number: number;
  readonly payload: Readonly<Record<string, string>>;
}

import type { ImportProcessPort } from '../../application/port/ImportProcessPort';

export class PgImportProcess implements ImportProcessPort {
  private readonly members: MemberPort;
  private readonly transactionAccess = new PgTransactionAccess();
  constructor(
    private readonly transactions: TransactionManager,
    private readonly identities: IdentityPrincipal,
    private readonly access: MemberImportAccessPort,
    profiles: Pick<MemberAccessPort, 'syncProfile'>
  ) {
    this.members = new MemberPort(profiles);
  }

  async find(id: string, execution: ImportExecution): Promise<ImportTarget | null> {
    const result = await this.transactions.read(options({ id, scope: execution.scope }, execution.signal, execution.deadline), (context) =>
      this.transactionAccess.database(context).query<TargetRow>('select id,organization_id,object_ref,sha256,state from member.importjob where id=$1', [id])
    );
    const row = result.rows[0];
    return row ? { id: row.id, scope: row.organization_id, reference: row.object_ref, sha256: row.sha256, state: row.state } : null;
  }

  async stage(target: ImportTarget, rows: readonly Readonly<Record<string, string>>[], execution: ImportExecution): Promise<void> {
    const transaction = options(target, execution.signal, execution.deadline);
    await this.transactions.write(transaction, async (context) => {
      const database = this.transactionAccess.database(context);
      await database.query("update member.importjob set state='validating',last_error=null,updated_at=clock_timestamp() where id=$1", [target.id]);
      await database.query('delete from member.importrow where job_id=$1', [target.id]);
      await database.query('delete from member.importerror where job_id=$1', [target.id]);
    });
    for (let offset = 0; offset < rows.length; offset += 500) {
      const batch = rows.slice(offset, offset + 500).map((payload, index) => ({ row_number: offset + index + 2, payload }));
      await this.transactions.write(transaction, async (context) => {
        await this.transactionAccess.database(context).query(
          `insert into member.importrow(job_id,organization_id,row_number,payload)
          select $1,$2,item.row_number,item.payload from jsonb_to_recordset($3::jsonb) item(row_number integer,payload jsonb)`,
          [target.id, target.scope, JSON.stringify(batch)]
        );
      });
    }
    await this.transactions.write(transaction, async (context) => {
      await this.transactionAccess.database(context).query(
        `update member.importjob set state='ready',total_count=$2,cursor_value=0,success_count=0,failure_count=0,
        validation_summary=jsonb_build_object('format','csv','rows',$2,'columns',$3::jsonb,'shardSize',500),updated_at=clock_timestamp() where id=$1`,
        [target.id, rows.length, JSON.stringify(Object.keys(rows[0]!).sort())]
      );
    });
  }

  async process(target: ImportTarget, signal: AbortSignal, deadline: number): Promise<boolean> {
    const transaction = options(target, signal, deadline);
    const selected = await this.transactions.read(transaction, async (context) => {
      const database = this.transactionAccess.database(context);
      const job = await database.query<{ cursor_value: number; total_count: number }>(
        `select cursor_value,total_count from member.importjob
        where id=$1 and state in('ready','running')`,
        [target.id]
      );
      if (!job.rows[0]) return null;
      const staged = await database.query<StagedRow>(
        `select row_number,payload from member.importrow where job_id=$1 and row_number>$2
        order by row_number limit 500`,
        [target.id, job.rows[0].cursor_value + 1]
      );
      if (staged.rows.length === 0 && job.rows[0].cursor_value < job.rows[0].total_count) throw new Error('MEMBER_IMPORT_STAGE_INCOMPLETE');
      return Object.freeze({ cursor: job.rows[0].cursor_value, total: job.rows[0].total_count, rows: Object.freeze(staged.rows) });
    });
    if (!selected) return true;
    let successes = 0;
    let failures = 0;
    for (const row of selected.rows) {
      if (signal.aborted) throw signal.reason;
      try {
        await this.transactions.write(transaction, (context) => importMember(context, this.identities, this.access, this.members, target.scope, row.payload));
        successes += 1;
      } catch (cause) {
        failures += 1;
        await this.transactions.write(transaction, (context) =>
          this.transactionAccess
            .database(context)
            .query(
              `insert into member.importerror(job_id,row_number,reason_code,field,detail) values($1,$2,$3,null,$4)
          on conflict(job_id,row_number,reason_code) do update set detail=excluded.detail`,
              [target.id, row.row_number, importCode(cause, 'MEMBER_IMPORT_ROW_FAILED'), importDetail(cause)]
            )
            .then(() => undefined)
        );
      }
    }
    const cursor = selected.rows.at(-1)?.row_number ? selected.rows.at(-1)!.row_number - 1 : selected.cursor;
    const more = cursor < selected.total;
    await this.transactions.write(transaction, async (context) => {
      const database = this.transactionAccess.database(context);
      await database.query(
        `update member.importjob set state=$2,cursor_value=$3,success_count=success_count+$4,failure_count=failure_count+$5,
        validation_summary=validation_summary||jsonb_build_object('processed',$3,'errors',failure_count+$5),last_error=null,updated_at=clock_timestamp() where id=$1`,
        [target.id, more ? 'running' : 'reporting', cursor, successes, failures]
      );
      if (more) await continuation(database, target, cursor);
    });
    return !more;
  }

  async failures(target: ImportTarget, execution: ImportExecution): Promise<readonly ImportFailure[]> {
    const result = await this.transactions.read(options(target, execution.signal, execution.deadline), (context) =>
      this.transactionAccess
        .database(context)
        .query<{ row_number: number; reason_code: string; field: string | null; detail: string }>('select row_number,reason_code,field,detail from member.importerror where job_id=$1 order by row_number,reason_code', [target.id])
    );
    return result.rows.map((row) => ({ row: row.row_number, reason: row.reason_code, field: row.field, detail: row.detail }));
  }
  async complete(target: ImportTarget, report: StoredObject, execution: ImportExecution): Promise<void> {
    await this.transactions.write(options(target, execution.signal, execution.deadline), async (context) => {
      const database = this.transactionAccess.database(context);
      await database.query(
        `update member.importjob set state='completed',report_object_ref=$2,report_sha256=$3,report_size=$4,
        last_error=null,updated_at=clock_timestamp() where id=$1 and state='reporting'`,
        [target.id, report.reference, report.sha256, report.size]
      );
      await database.query('delete from member.importrow where job_id=$1', [target.id]);
    });
  }
  async reject(target: ImportTarget, code: string, detail: string, execution: ImportExecution): Promise<void> {
    await this.transactions.write(options(target, execution.signal, execution.deadline), (context) =>
      this.transactionAccess
        .database(context)
        .query(
          `update member.importjob set state='failed',last_error=$2,
      validation_summary=validation_summary||jsonb_build_object('code',$3),updated_at=clock_timestamp() where id=$1`,
          [target.id, detail, code]
        )
        .then(() => undefined)
    );
  }
  async fault(target: ImportTarget, detail: string, execution: ImportExecution): Promise<void> {
    await this.transactions.write(options(target, execution.signal, execution.deadline), (context) =>
      this.transactionAccess
        .database(context)
        .query('update member.importjob set last_error=$2,updated_at=clock_timestamp() where id=$1', [target.id, detail])
        .then(() => undefined)
    );
  }
}

async function continuation(client: SqlExecutor, target: ImportTarget, cursor: number): Promise<void> {
  await new PgRuntimeWriter(client).schedule({ id: `job:${target.id}:${cursor}`, kind: 'memberimport', owner: 'member', scope: target.scope, payload: { import: target.id }, priority: 100 });
}

function options(target: Pick<ImportTarget, 'id' | 'scope'>, signal: AbortSignal, deadline: number) {
  return { tenant: target.scope, membership: '', scope: target.scope, actor: 'job:memberimport', trace: target.id, operation: 'job.member.import', workload: 'jobs' as const, signal, deadline };
}
