import { createHash, randomUUID } from 'node:crypto';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ExportPort, RuntimeExportDownload, RuntimeExportRecord, RuntimeExportWork } from '../../public/ExportPort';
interface Row { readonly id: string; readonly kind: string; readonly state: string; readonly objectKey: string | null; readonly expiresAt: Date | string | null; readonly createdAt: Date | string; readonly updatedAt: Date | string; }
export class PgExportPort implements ExportPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async create(context: WriteTransactionContext, input: Parameters<ExportPort['create']>[1]): Promise<RuntimeExportRecord> {
    if (input.scope !== context.scope || input.actor !== context.actor || input.authorization.actor !== input.actor) throw new DomainError('AUTHORIZATION_DENIED');
    const id = `export:${randomUUID()}`;
    const idempotency = createHash('sha256').update(JSON.stringify([input.scope, input.owner, input.kind, input.actor, input.idempotency])).digest('hex');
    const result = await this.transactions.database(context).query<Row>(
      `insert into runtime.exports(id,tenant_id,scope_id,owner,kind,filter_snapshot,authorization_snapshot,state,idempotency_key,version,created_by,updated_by,created_at,updated_at,retention_until)
       values($1,$2,$2,$3,$4,$5::jsonb,$6::jsonb,'queued',$7,1,$8,$8,clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '90 days')
       on conflict(scope_id,owner,idempotency_key) do update set updated_at=runtime.exports.updated_at
       where runtime.exports.kind=excluded.kind and runtime.exports.created_by=excluded.created_by
         and runtime.exports.filter_snapshot=excluded.filter_snapshot
         and runtime.exports.authorization_snapshot-'capturedAt'=excluded.authorization_snapshot-'capturedAt'
       returning id,kind,state,object_key as "objectKey",download_expires_at as "expiresAt",created_at as "createdAt",updated_at as "updatedAt"`,
      [id, input.scope, input.owner, input.kind, JSON.stringify(input.snapshot), JSON.stringify(input.authorization), idempotency, input.actor]
    );
    if (!result.rows[0]) throw new DomainError('IDEMPOTENCY_CONFLICT');
    return projection(result.rows[0]!);
  }
  async read(context: ReadTransactionContext, id: string, scope: string, owner: string): Promise<RuntimeExportRecord | null> {
    const result = await this.transactions.database(context).query<Row>(`select id,kind,state,object_key as "objectKey",download_expires_at as "expiresAt",created_at as "createdAt",updated_at as "updatedAt" from runtime.exports where id=$1 and scope_id=$2 and owner=$3`, [id, scope, owner]);
    return result.rows[0] ? projection(result.rows[0]) : null;
  }
  async claim(context: WriteTransactionContext, id: string, scope: string, owner: string): Promise<RuntimeExportWork | null> {
    const result = await this.transactions.database(context).query<{
      id: string; scope: string; kind: string; snapshot: Readonly<Record<string, unknown>>; authorization: Readonly<Record<string, unknown>>;
    }>(
      `update runtime.exports set state='running',version=version+1,updated_by='system:runtime',updated_at=clock_timestamp()
       where id=$1 and scope_id=$2 and owner=$3 and state='queued'
       returning id,scope_id scope,kind,filter_snapshot snapshot,authorization_snapshot authorization`,
      [id, scope, owner]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ ...row, snapshot: Object.freeze({ ...row.snapshot }), authorization: Object.freeze({ ...row.authorization }) }) : null;
  }
  async work(context: ReadTransactionContext, id: string, scope: string, owner: string): Promise<RuntimeExportWork | null> {
    const result = await this.transactions.database(context).query<RuntimeExportWork>(
      `select id,scope_id scope,kind,filter_snapshot snapshot,authorization_snapshot authorization
       from runtime.exports where id=$1 and scope_id=$2 and owner=$3 and created_by=$4`, [id, scope, owner, context.actor]);
    const row = result.rows[0];
    return row ? Object.freeze({ ...row, snapshot: Object.freeze({ ...row.snapshot }), authorization: Object.freeze({ ...row.authorization }) }) : null;
  }
  async ready(context: WriteTransactionContext, id: string, scope: string, owner: string, value: Parameters<ExportPort['ready']>[4]): Promise<void> {
    if (!/^[0-9a-f]{64}$/.test(value.sha256) || !/^[0-9a-f]{64}$/.test(value.tokenHash) || !Number.isSafeInteger(value.rows) || value.rows < 0 || Date.parse(value.expiresAt) <= Date.now()) throw new Error('RUNTIME_EXPORT_RESULT_INVALID');
    const result = await this.transactions.database(context).query(
      `update runtime.exports set state='ready',object_key=$4,object_hash=$5,rows_exported=$6,download_token_hash=decode($7,'hex'),
       download_expires_at=$8,version=version+1,updated_by='system:runtime',updated_at=clock_timestamp()
       where id=$1 and scope_id=$2 and owner=$3 and state='running'`,
      [id, scope, owner, value.reference, value.sha256, value.rows, value.tokenHash, value.expiresAt]
    );
    if (result.rowCount !== 1) throw new Error('RUNTIME_EXPORT_READY_CONFLICT');
  }
  async fail(context: WriteTransactionContext, id: string, scope: string, owner: string, terminal: boolean): Promise<void> {
    const result = await this.transactions.database(context).query(
      `update runtime.exports set state=$4,version=version+1,updated_by='system:runtime',updated_at=clock_timestamp()
       where id=$1 and scope_id=$2 and owner=$3 and state='running'`, [id, scope, owner, terminal ? 'failed' : 'queued']
    );
    if (result.rowCount !== 1) throw new Error('RUNTIME_EXPORT_FAIL_CONFLICT');
  }
  async take(context: WriteTransactionContext, id: string, scope: string, owner: string): Promise<RuntimeExportDownload | null> {
    const result = await this.transactions.database(context).query<Row & { readonly reference: string }>(
      `update runtime.exports set downloaded_at=clock_timestamp(),version=version+1,updated_by=$4,updated_at=clock_timestamp()
       where id=$1 and scope_id=$2 and owner=$3 and created_by=$4 and state='ready' and downloaded_at is null and download_expires_at>clock_timestamp()
       returning id,kind,state,object_key as "objectKey",object_key reference,download_expires_at as "expiresAt",created_at as "createdAt",updated_at as "updatedAt"`,
      [id, scope, owner, context.actor]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ record: projection(row), reference: row.reference }) : null;
  }
}
function projection(row: Row): RuntimeExportRecord {
  const expired = row.expiresAt !== null && new Date(row.expiresAt).getTime() <= Date.now();
  const state = row.state === 'ready' ? expired ? 'expired' : 'completed' : row.state === 'cancelled' ? 'failed' : row.state as RuntimeExportRecord['state'];
  return Object.freeze({ id: row.id, kind: row.kind, state, expiresAt: new Date(row.expiresAt ?? Date.now() + 86_400_000).toISOString(), ...(row.objectKey ? { fileName: row.objectKey.split('/').at(-1) ?? row.objectKey } : {}), createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString() });
}
