import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { describe, expect, it } from 'vitest';
import { result, withWriteTransaction } from '../../../../test/TransactionFixture';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgRuntimeImporting } from './PgRuntimeImporting';

const runtimeMigration = readFileSync(new URL('../../../../../../../database/migrations/20260904011000_prepare_runtime_tasks.sql', import.meta.url), 'utf8');
const catalogMigration = readFileSync(new URL('../../../../../../../database/migrations/20260904020000_prepare_catalog.sql', import.meta.url), 'utf8');
const leaseMigration = readFileSync(new URL('../../../../../../../database/migrations/20260904029400_enforce_import_leases.sql', import.meta.url), 'utf8');
const runtimeSchema = `${runtimeMigration.slice(runtimeMigration.indexOf('create table runtime.imports('), runtimeMigration.indexOf('create table runtime.exports('))}
  alter table runtime.imports add column authorization_snapshot jsonb not null default '{}'::jsonb;`;
const payloadSchema = catalogMigration.slice(catalogMigration.indexOf('alter table runtime.import_chunks add column payload'), catalogMigration.indexOf('alter table runtime.import_errors enable row level security'));
const leaseSchema = leaseMigration.slice(leaseMigration.indexOf('alter table runtime.import_chunks add column lease_expires_at'), leaseMigration.indexOf('select runtime.record_migration_evidence'));
const leaseGate = leaseMigration.slice(leaseMigration.indexOf('do $precondition$'), leaseMigration.indexOf('alter table runtime.import_chunks add column lease_expires_at'));

describe('runtime import recovery and fencing', () => {
  it('resumes immutable staged chunks without deleting or re-encrypting them', async () => {
    const data = await fixture();
    try {
      expect(await write(data, context => data.importing.begin(context, data.id, 'voucher'))).toEqual({ sequence: 0, staged: 0 });
      await write(data, context => data.importing.stage(context, data.id, 'voucher', [{ sequence: 0, rows: [
        { row: 2, payload: { ciphertext: 'encrypted-one' } }, { row: 3, payload: { ciphertext: 'encrypted-two' } },
      ] }]));
      const before = await data.database.query<{ payload: unknown; payload_hash: string }>('select payload,payload_hash from runtime.import_chunks where import_id=$1', [data.id]);
      expect(await write(data, context => data.importing.begin(context, data.id, 'voucher'))).toEqual({ sequence: 1, staged: 2 });
      const after = await data.database.query<{ payload: unknown; payload_hash: string }>('select payload,payload_hash from runtime.import_chunks where import_id=$1', [data.id]);
      expect(after.rows).toEqual(before.rows);
      await write(data, context => data.importing.ready(context, data.id, 'voucher', 2, ['number', 'secret']));
      expect((await data.database.query(`select state,rows_total,checkpoint->>'chunkSize' "chunkSize",checkpoint->>'format' format
        from runtime.imports where id=$1`, [data.id])).rows).toEqual([{ state: 'ready', rows_total: 2, chunkSize: '1000', format: 'text/csv' }]);
    } finally { await data.database.close(); }
  });

  it('binds completion to the active owner, scope and fencing token while preserving counters', async () => {
    const data = await readyFixture();
    try {
      const chunk = await write(data, context => data.importing.claim(context, data.id, 'voucher', 60));
      expect(chunk).toMatchObject({ sequence: 0, token: 1 });
      await expect(write(data, context => data.importing.assertLease(context, data.id, 'catalog', 0, 1))).rejects.toThrow('RUNTIME_IMPORT_CHUNK_LEASE_LOST');
      await expect(write(data, context => data.importing.finish(context, data.id, 'voucher', 0, 2, 1, [failure(3)]))).rejects.toThrow('RUNTIME_IMPORT_CHUNK_LEASE_LOST');
      await write(data, context => data.importing.assertLease(context, data.id, 'voucher', 0, 1));
      expect(await write(data, context => data.importing.finish(context, data.id, 'voucher', 0, 1, 1, [failure(3)]))).toBe(true);
      expect((await data.database.query(`select state,rows_processed,rows_succeeded,rows_failed from runtime.imports where id=$1`, [data.id])).rows)
        .toEqual([{ state: 'running', rows_processed: 2, rows_succeeded: 1, rows_failed: 1 }]);
      expect((await data.database.query('select row_number,reason_code from runtime.import_errors where import_id=$1', [data.id])).rows)
        .toEqual([{ row_number: 3, reason_code: 'VALIDATION_FAILED' }]);
      await expect(write(data, context => data.importing.finish(context, data.id, 'voucher', 0, 1, 1, [failure(3)]))).rejects.toThrow('RUNTIME_IMPORT_CHUNK_LEASE_LOST');
    } finally { await data.database.close(); }
  });

  it('releases transient failures for retry and rejects stale workers after the token advances', async () => {
    const data = await readyFixture();
    try {
      const first = await write(data, context => data.importing.claim(context, data.id, 'voucher', 60));
      expect(first?.token).toBe(1);
      await write(data, context => data.importing.abandon(context, data.id, 'voucher', 0, 1, 'DATABASE_UNAVAILABLE'));
      const second = await write(data, context => data.importing.claim(context, data.id, 'voucher', 60));
      expect(second?.token).toBe(2);
      await expect(write(data, context => data.importing.assertLease(context, data.id, 'voucher', 0, 1))).rejects.toThrow('RUNTIME_IMPORT_CHUNK_LEASE_LOST');
      await write(data, context => data.importing.assertLease(context, data.id, 'voucher', 0, 2));
      await expect(data.database.exec(`update runtime.import_chunks set payload='[]'::jsonb,version=version+1,updated_at=clock_timestamp()
        where import_id='${data.id}'`)).rejects.toThrow('RUNTIME_IMPORT_CHUNK_IMMUTABLE');
    } finally { await data.database.close(); }
  });

  it('takes over only an expired lease and increments its fencing token', async () => {
    const data = await fixture();
    try {
      await data.database.query(`update runtime.imports set state='ready',rows_total=1 where id=$1`, [data.id]);
      await data.database.query(`insert into runtime.import_chunks(id,tenant_id,scope_id,import_id,sequence,row_start,row_end,payload_hash,payload,state,
        fencing_token,lease_expires_at,checkpoint,error_count,version,created_at,updated_at)
        values('importchunk:expired:0','scope:test','scope:test',$1,0,2,2,repeat('b',64),'[{"row":2,"payload":{}}]'::jsonb,
        'running',1,clock_timestamp()-interval '1 minute','{}'::jsonb,0,1,clock_timestamp()-interval '3 minutes',clock_timestamp()-interval '2 minutes')`, [data.id]);
      const claimed = await write(data, context => data.importing.claim(context, data.id, 'voucher', 60));
      expect(claimed).toMatchObject({ sequence: 0, token: 2 });
      expect((await data.database.query('select lease_expires_at>clock_timestamp() active from runtime.import_chunks where import_id=$1', [data.id])).rows)
        .toEqual([{ active: true }]);
    } finally { await data.database.close(); }
  });

  it('blocks migration while an unfenced legacy worker still owns a chunk', async () => {
    const database = await runtimeDatabase();
    try {
      await database.exec(`create schema runtime; create table runtime.schemaversion(version text primary key); ${runtimeSchema} ${payloadSchema}
        insert into runtime.schemaversion values('20260904029300');
        ${importSql('import:legacy', 'running')}
        insert into runtime.import_chunks(id,tenant_id,scope_id,import_id,sequence,row_start,row_end,payload_hash,payload,state,fencing_token,
          checkpoint,error_count,version,created_at,updated_at)
        values('importchunk:legacy:0','scope:test','scope:test','import:legacy',0,2,2,repeat('b',64),'[]','running',1,'{}',0,1,now(),now());`);
      await expect(database.exec(leaseGate)).rejects.toThrow('RUNTIME_IMPORT_CHUNK_DRAIN_REQUIRED');
      expect((await database.query('select count(*)::integer count from runtime.import_chunks')).rows).toEqual([{ count: 1 }]);
    } finally { await database.close(); }
  });

  it('allows retention cleanup only after the parent import is terminal and expired', async () => {
    const data = await readyFixture();
    try {
      await expect(data.database.query('delete from runtime.import_chunks where import_id=$1', [data.id])).rejects.toThrow('RUNTIME_IMPORT_CHUNK_IMMUTABLE');
      const chunk = await write(data, context => data.importing.claim(context, data.id, 'voucher', 60));
      await write(data, context => data.importing.finish(context, data.id, 'voucher', chunk!.sequence, chunk!.token, 2, []));
      await write(data, context => data.importing.complete(context, data.id, 'voucher', { reference: 'report:one', sha256: 'c'.repeat(64), size: 10 }));
      await data.database.query(`update runtime.imports set created_at=clock_timestamp()-interval '2 days',
        retention_until=clock_timestamp()-interval '1 day' where id=$1`, [data.id]);
      await data.database.query('delete from runtime.import_chunks where import_id=$1', [data.id]);
      expect((await data.database.query('select count(*)::integer count from runtime.import_chunks where import_id=$1', [data.id])).rows).toEqual([{ count: 0 }]);
    } finally { await data.database.close(); }
  });
});

function failure(row: number) {
  return Object.freeze({ row, reason: 'VALIDATION_FAILED', field: 'number', detail: '格式错误' });
}

function importSql(id: string, state = 'uploaded') {
  return `insert into runtime.imports(id,tenant_id,scope_id,owner,kind,object_key,file_hash,file_name,media_type,size_bytes,state,
    rows_total,rows_processed,rows_succeeded,rows_failed,checkpoint,error_report_key,idempotency_key,version,created_by,updated_by,created_at,updated_at,retention_until)
    values('${id}','scope:test','scope:test','voucher','credential','object:test',repeat('a',64),'voucher.csv','text/csv',10,'${state}',
    null,0,0,0,'{}',null,'${id}',1,'actor:test','actor:test',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '90 days');`;
}

async function readyFixture() {
  const data = await fixture();
  await write(data, context => data.importing.begin(context, data.id, 'voucher'));
  await write(data, context => data.importing.stage(context, data.id, 'voucher', [{ sequence: 0, rows: [
    { row: 2, payload: { ciphertext: 'encrypted-one' } }, { row: 3, payload: { ciphertext: 'encrypted-two' } },
  ] }]));
  await write(data, context => data.importing.ready(context, data.id, 'voucher', 2, ['number']));
  return data;
}

async function fixture() {
  const database = await runtimeDatabase();
  await database.exec(`create schema runtime; ${runtimeSchema} ${payloadSchema} ${leaseSchema}`);
  const query = async (sql: string, values?: readonly unknown[]) => {
    const executed = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
    return { ...result(executed.rows), rowCount: executed.affectedRows ?? executed.rows.length };
  };
  const importing = new PgRuntimeImporting();
  const id = 'import:test';
  await withWriteTransaction(query, context => importing.create(context, { id, scope: 'scope:test', owner: 'voucher', kind: 'credential',
    reference: 'object:test', sha256: 'a'.repeat(64), name: 'voucher.csv', mediaType: 'text/csv', size: 10, actor: 'actor:test', authorization: {} }));
  return { database, query, importing, id };
}

async function runtimeDatabase(): Promise<PGlite> {
  const database = new PGlite({ extensions: { pgcrypto } });
  await database.exec('create extension if not exists pgcrypto');
  return database;
}

function write<T>(data: Awaited<ReturnType<typeof fixture>>, work: (context: WriteTransactionContext) => Promise<T>) {
  return withWriteTransaction(data.query, work);
}
