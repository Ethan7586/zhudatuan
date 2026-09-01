import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ImportExecution, ImportFailure, ImportTarget } from '../../../../foundation/application/BatchImport';
import { importCode, importDetail } from '../../../../foundation/infrastructure/ImportFile';
import type { StoredObject } from '../../../../foundation/infrastructure/ObjectStore';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import { importStock } from './StockImportRow';
import type { CatalogSku } from '../../../catalog/public/index';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';

interface TargetRow {
  readonly id: string;
  readonly scope_id: string;
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
  private readonly transactions = new PgTransactionAccess();
  constructor(
    private readonly manager: TransactionManager,
    private readonly catalog: CatalogSku
  ) {}

  async find(id: string, execution: ImportExecution): Promise<ImportTarget | null> {
    const result = await this.manager.read(transactionOptions({ id, scope: execution.scope }, execution.signal, execution.deadline), (context) =>
      this.transactions.database(context).query<TargetRow>('select id,scope_id,object_ref,sha256,state from inventory.importjob where id=$1', [id])
    );
    const row = result.rows[0];
    return row ? { id: row.id, scope: row.scope_id, reference: row.object_ref, sha256: row.sha256, state: row.state } : null;
  }

  async stage(target: ImportTarget, rows: readonly Readonly<Record<string, string>>[], execution: ImportExecution): Promise<void> {
    const options = transactionOptions(target, execution.signal, execution.deadline);
    await this.manager.write(options, async (context) => {
      const database = this.transactions.database(context);
      await database.query("update inventory.importjob set state='validating',last_error=null,updated_at=clock_timestamp() where id=$1", [target.id]);
      await database.query('delete from inventory.importrow where job_id=$1', [target.id]);
      await database.query('delete from inventory.importerror where job_id=$1', [target.id]);
    });
    for (let offset = 0; offset < rows.length; offset += 500) {
      const batch = rows.slice(offset, offset + 500).map((payload, index) => ({ row_number: offset + index + 2, payload }));
      await this.manager.write(options, async (context) => {
        await this.transactions.database(context).query(
          `insert into inventory.importrow(job_id,scope_id,row_number,payload)
          select $1,$2,item.row_number,item.payload from jsonb_to_recordset($3::jsonb) item(row_number integer,payload jsonb)`,
          [target.id, target.scope, JSON.stringify(batch)]
        );
      });
    }
    await this.manager.write(options, async (context) => {
      await this.transactions.database(context).query(
        `update inventory.importjob set state='ready',total_count=$2,cursor_value=0,success_count=0,failure_count=0,
        validation_summary=jsonb_build_object('format','csv','rows',$2,'columns',$3::jsonb,'shardSize',500),updated_at=clock_timestamp() where id=$1`,
        [target.id, rows.length, JSON.stringify(Object.keys(rows[0]!).sort())]
      );
    });
  }

  async process(target: ImportTarget, signal: AbortSignal, deadline: number): Promise<boolean> {
    const options = transactionOptions(target, signal, deadline);
    const selected = await this.manager.read(options, async (context) => {
      const database = this.transactions.database(context);
      const job = await database.query<{ cursor_value: number; total_count: number }>(
        `select cursor_value,total_count from inventory.importjob
        where id=$1 and state in('ready','running')`,
        [target.id]
      );
      if (!job.rows[0]) return null;
      const staged = await database.query<StagedRow>(
        `select row_number,payload from inventory.importrow where job_id=$1 and row_number>$2
        order by row_number limit 500`,
        [target.id, job.rows[0].cursor_value + 1]
      );
      if (staged.rows.length === 0 && job.rows[0].cursor_value < job.rows[0].total_count) throw new Error('INVENTORY_IMPORT_STAGE_INCOMPLETE');
      return Object.freeze({ cursor: job.rows[0].cursor_value, total: job.rows[0].total_count, rows: Object.freeze(staged.rows) });
    });
    if (!selected) return true;
    let successes = 0;
    let failures = 0;
    for (const row of selected.rows) {
      if (signal.aborted) throw signal.reason;
      try {
        await this.manager.write(options, (context) => importStock(this.transactions.database(context), this.catalog, target.scope, target.id, row.row_number, row.payload));
        successes += 1;
      } catch (cause) {
        failures += 1;
        await this.manager.write(options, (context) =>
          this.transactions
            .database(context)
            .query(
              `insert into inventory.importerror(job_id,scope_id,row_number,reason_code,field,detail) values($1,$2,$3,$4,null,$5)
          on conflict(job_id,row_number,reason_code) do update set detail=excluded.detail`,
              [target.id, target.scope, row.row_number, importCode(cause, 'INVENTORY_IMPORT_ROW_FAILED'), importDetail(cause)]
            )
            .then(() => undefined)
        );
      }
    }
    const cursor = selected.rows.at(-1)?.row_number ? selected.rows.at(-1)!.row_number - 1 : selected.cursor;
    const more = cursor < selected.total;
    await this.manager.write(options, async (context) => {
      const database = this.transactions.database(context);
      await database.query(
        `update inventory.importjob set state=$2,cursor_value=$3,success_count=success_count+$4,failure_count=failure_count+$5,
        validation_summary=validation_summary||jsonb_build_object('processed',$3,'errors',failure_count+$5),last_error=null,updated_at=clock_timestamp() where id=$1`,
        [target.id, more ? 'running' : 'reporting', cursor, successes, failures]
      );
      if (more) await continuation(database, target, cursor);
    });
    return !more;
  }

  async failures(target: ImportTarget, execution: ImportExecution): Promise<readonly ImportFailure[]> {
    const result = await this.manager.read(transactionOptions(target, execution.signal, execution.deadline), (context) =>
      this.transactions
        .database(context)
        .query<{ row_number: number; reason_code: string; field: string | null; detail: string }>('select row_number,reason_code,field,detail from inventory.importerror where job_id=$1 order by row_number,reason_code', [target.id])
    );
    return result.rows.map((row) => ({ row: row.row_number, reason: row.reason_code, field: row.field, detail: row.detail }));
  }
  async complete(target: ImportTarget, report: StoredObject, execution: ImportExecution): Promise<void> {
    await this.manager.write(transactionOptions(target, execution.signal, execution.deadline), (context) =>
      this.transactions
        .database(context)
        .query(
          `update inventory.importjob set state='completed',report_object_ref=$2,report_sha256=$3,report_size=$4,
      last_error=null,updated_at=clock_timestamp() where id=$1 and state='reporting'`,
          [target.id, report.reference, report.sha256, report.size]
        )
        .then(() => undefined)
    );
  }
  async reject(target: ImportTarget, code: string, detail: string, execution: ImportExecution): Promise<void> {
    await this.manager.write(transactionOptions(target, execution.signal, execution.deadline), (context) =>
      this.transactions
        .database(context)
        .query(
          `update inventory.importjob set state='failed',last_error=$2,
      validation_summary=validation_summary||jsonb_build_object('code',$3),updated_at=clock_timestamp() where id=$1`,
          [target.id, detail, code]
        )
        .then(() => undefined)
    );
  }
  async fault(target: ImportTarget, detail: string, execution: ImportExecution): Promise<void> {
    await this.manager.write(transactionOptions(target, execution.signal, execution.deadline), (context) =>
      this.transactions
        .database(context)
        .query('update inventory.importjob set last_error=$2,updated_at=clock_timestamp() where id=$1', [target.id, detail])
        .then(() => undefined)
    );
  }
}

async function continuation(client: SqlExecutor, target: ImportTarget, cursor: number): Promise<void> {
  await new PgRuntimeWriter(client).schedule({ id: `job:${target.id}:${cursor}`, kind: 'inventoryimport', owner: 'inventory', scope: target.scope, payload: { import: target.id }, priority: 100 });
}

function transactionOptions(target: Pick<ImportTarget, 'id' | 'scope'>, signal: AbortSignal, deadline: number) {
  return { tenant: target.scope, membership: '', scope: target.scope, actor: 'job:inventoryimport', trace: target.id, operation: 'job.inventory.import', workload: 'jobs' as const, signal, deadline };
}
