import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
import type { OperationId } from '@shop/contract';
import type { PoolClient } from 'pg';
import { PgTransactionAccess } from '../../../adapter/database/PgTransactionAccess';
import { PgTransactionManager } from '../../../adapter/database/PgTransactionManager';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { AccessContext } from '../../../foundation/security/AccessContext';
import type { ObjectStore } from '../../runtime/public/ObjectPort';
import { result } from '../../../test/TransactionFixture';
import type { ExportPort, ImportPort, JobPort, RuntimeExportWork } from '../../runtime/public';
import { PgExportPort } from '../../runtime/infrastructure/persistence/PgExportPort';
import type { ApprovalPort, ApprovalReadPort } from '../../approval/public';
import type { VoucherCall } from '../application/port/VoucherCall';
import type { CredentialProtector } from '../application/port/CredentialProtector';
import { PgCredentialRepository } from '../infrastructure/persistence/PgCredentialRepository';
import { PgIssueOrderRepository } from '../infrastructure/persistence/PgIssueOrderRepository';
import { PgActionBatchRepository } from '../infrastructure/persistence/PgActionBatchRepository';
import { captureExportSnapshot, pruneExportSnapshots, readExportSnapshot } from '../infrastructure/persistence/ExportSnapshot';
import { PgVoucherExportProcess } from '../infrastructure/persistence/PgVoucherExportProcess';
import { RunExport } from '../../runtime/application/process/RunExport';

const migration = readFileSync(new URL('../../../../../../database/migrations/20260904028600_prepare_voucher_exports.sql', import.meta.url), 'utf8');
const schema = migration.slice(migration.indexOf('create table voucher.exportsnapshot('), migration.indexOf('select runtime.record_migration_evidence'));
const runtime = readFileSync(new URL('../../../../../../database/migrations/20260904011000_prepare_runtime_tasks.sql', import.meta.url), 'utf8');
const runtimeSchema = runtime.slice(runtime.indexOf('create table runtime.exports('), runtime.indexOf('create table runtime.deadletters('));
type Kind = 'credential' | 'issueorder' | 'action';
const operations = { credential: 'voucher.credentialexports.create', issueorder: 'voucher.issueorderexports.create', action: 'voucher.actionexports.create' } as const;

describe('frozen credential, issuance and action exports', () => {
  it.each(['credential', 'issueorder', 'action'] as const)('renders %s from frozen pages despite changes, additions and retries', async kind => {
    const data = await fixture(1002);
    try {
      const work = await data.create(kind);
      const frozen = await data.read(work);
      expect(frozen.count).toBe(1002);
      await data.database.exec(`update voucher.credential set state='allocated',number_ciphertext='rewrapped',secret_ciphertext='rewrapped';
        update voucher.issueitem set state='succeeded',error_code=null; update voucher.voucher set number_masked='changed';
        update voucher.actionitem set state='succeeded',previous_state='disabled',next_state='active';
        insert into voucher.actionitem values('action:one','scope:test','voucher:later','queued',null,null,null,false,now());`);
      const output = writer();
      const reveal = vi.fn(async (cipher: string) => cipher.startsWith('cipher-number:') ? 'VC001234' : 'Secret!23');
      const ready = vi.fn();
      const exports = { claim: vi.fn(async () => work), ready, fail: vi.fn() } as unknown as ExportPort;
      data.query.mockClear();
      await runExport(new PgVoucherExportProcess(data.manager, exports, { reveal } as unknown as CredentialProtector, 3, { assert: vi.fn() }), output.objects, input(work.id));
      expect(output.csv().split('\r\n')).toHaveLength(1004);
      expect(output.csv()).not.toMatch(/rewrapped|changed|voucher:later/);
      expect(ready).toHaveBeenCalledWith(expect.anything(), work.id, 'scope:test', 'voucher', expect.objectContaining({ rows: 1002 }));
      const reads = data.query.mock.calls.map(([sql]) => sql);
      expect(reads.filter(sql => sql.includes('from voucher.exportsnapshotitem where snapshot_id'))).toHaveLength(3);
      expect(reads.some(sql => /from voucher\.(credential|issueitem|actionitem)\b/u.test(sql))).toBe(false);
      if (kind === 'credential') {
        expect(reveal).toHaveBeenCalledTimes(2004);
        expect(reveal).toHaveBeenCalledWith('cipher-number:1', 'number', { scope: 'scope:test', pool: 'pool:one', credential: 'credential:00001' });
        expect(output.csv()).toContain('"VC001234","Secret!23"');
      } else {
        expect(reveal).not.toHaveBeenCalled();
        expect(output.csv()).not.toMatch(/Secret!23|cipher-number|cipher-secret/);
      }
      const replay = await data.create(kind);
      expect(replay.id).toBe(work.id);
      expect(await data.read(replay)).toEqual(frozen);
    } finally { await data.database.close(); }
  });

  it.each(['credential', 'issueorder', 'action'] as const)('rejects foreign %s targets before creating an export or job', async kind => {
    const data = await fixture(1);
    try {
      await expect(data.create(kind, 'foreign')).rejects.toThrow('RESOURCE_NOT_FOUND');
      expect((await data.database.query(`select count(*)::integer count from runtime.exports`)).rows).toEqual([{ count: 0 }]);
      expect(data.jobs.create).not.toHaveBeenCalled();
    } finally { await data.database.close(); }
  });

  it('binds reads and replay to the original scope, actor, kind and filters', async () => {
    const data = await fixture(2);
    try {
      const work = await data.create('credential');
      for (const changed of [{ ...work, scope: 'foreign' }, { ...work, kind: 'action' },
        { ...work, authorization: { ...work.authorization, actor: 'other' } }, { ...work, snapshot: { ...work.snapshot, pool: 'other' } }]) {
        await expect(data.read(changed)).rejects.toThrow('VOUCHER_EXPORT_SNAPSHOT_INVALID');
      }
      await expect(data.manager.write(options(), context => captureExportSnapshot(new PgTransactionAccess().database(context), {
        id: work.id, scope: work.scope, kind: 'credential', filter: { ...work.snapshot, pool: 'other' }, actor: 'actor:test' }))).rejects.toThrow('IDEMPOTENCY_CONFLICT');
      const persisted = JSON.stringify((await data.database.query(`select * from voucher.exportsnapshotitem`)).rows);
      expect(persisted).toContain('cipher-secret:');
      expect(persisted).not.toContain('Secret!23');
    } finally { await data.database.close(); }
  });

  it('rolls back the Runtime export and the entire projection if queuing fails', async () => {
    const data = await fixture(2);
    try {
      data.jobs.create.mockRejectedValueOnce(new Error('QUEUE_UNAVAILABLE'));
      await expect(data.create('action')).rejects.toThrow('QUEUE_UNAVAILABLE');
      for (const table of ['runtime.exports', 'voucher.exportsnapshot', 'voucher.exportsnapshotitem'])
        expect((await data.database.query(`select count(*)::integer count from ${table}`)).rows).toEqual([{ count: 0 }]);
      expect(data.query.mock.calls.some(([sql]) => sql === 'rollback')).toBe(true);
    } finally { await data.database.close(); }
  });

  it('rejects updates, extra rows, cross-scope rows and credential fields in business-only exports', async () => {
    const data = await fixture(2);
    try {
      const work = await data.create('action');
      await expect(data.database.query(`update voucher.exportsnapshot set result_count=3 where id=$1`, [work.id])).rejects.toThrow('VOUCHER_SNAPSHOT_IMMUTABLE');
      await expect(data.database.query(`update voucher.exportsnapshotitem set cells='[]' where snapshot_id=$1`, [work.id])).rejects.toThrow('VOUCHER_SNAPSHOT_IMMUTABLE');
      for (const change of ['ordinal+2,scope_id', "ordinal,'foreign'"]) {
        const [ordinal, scope] = change.split(',');
        await expect(data.database.query(`insert into voucher.exportsnapshotitem(snapshot_id,ordinal,scope_id,cells)
          select snapshot_id,${ordinal},${scope},cells from voucher.exportsnapshotitem where snapshot_id=$1 limit 1`, [work.id])).rejects.toThrow('VOUCHER_EXPORT_SNAPSHOT_INVALID');
      }
      await data.database.query(`delete from voucher.exportsnapshotitem where snapshot_id=$1 and ordinal=2`, [work.id]);
      await expect(data.database.query(`insert into voucher.exportsnapshotitem(snapshot_id,scope_id,ordinal,cells,credential_id,pool_id,number_ciphertext,secret_ciphertext)
        select snapshot_id,scope_id,2,cells,'credential:evil','pool:one','cipher','cipher' from voucher.exportsnapshotitem where snapshot_id=$1`, [work.id])).rejects.toThrow('VOUCHER_EXPORT_SNAPSHOT_INVALID');
    } finally { await data.database.close(); }
  });

  it.each(['missing row', 'expired'] as const)('never publishes a %s snapshot and fails without returning a file', async corruption => {
    const data = await fixture(2);
    try {
      const work = await data.create('action');
      if (corruption === 'missing row') await data.database.query(`delete from voucher.exportsnapshotitem where snapshot_id=$1 and ordinal=2`, [work.id]);
      else await expire(data.database, work.id);
      const output = writer(); const ready = vi.fn(); const fail = vi.fn();
      await expect(runExport(new PgVoucherExportProcess(data.manager, { claim: vi.fn(async () => work), ready, fail } as unknown as ExportPort,
        {} as CredentialProtector, 3, { assert: vi.fn() }), output.objects, input(work.id))).rejects.toThrow(corruption === 'expired' ? 'VOUCHER_EXPORT_SNAPSHOT_INVALID' : 'EXPORT_ROW_COUNT_MISMATCH');
      expect(ready).not.toHaveBeenCalled();
      expect(fail).toHaveBeenCalled();
      if (corruption === 'expired') expect(output.objects.create).not.toHaveBeenCalled();
      else expect(output.abort).toHaveBeenCalledOnce();
    } finally { await data.database.close(); }
  });

  it('enforces RLS and worker immutability, then prunes expired projections in bounded chunks', async () => {
    const data = await fixture(1002);
    try {
      const expired = await data.create('credential');
      const active = await data.create('action');
      await data.database.exec(`set role shopapp; select set_config('app.scope_id','other',false);`);
      expect((await data.database.query(`select * from voucher.exportsnapshot`)).rows).toEqual([]);
      await data.database.exec('reset role; set role shopjob');
      await expect(data.database.query(`update voucher.exportsnapshot set result_count=0`)).rejects.toThrow(/permission denied/);
      await expect(data.database.query(`insert into voucher.exportsnapshotitem select * from voucher.exportsnapshotitem limit 1`)).rejects.toThrow(/permission denied/);
      expect((await data.database.query(`delete from voucher.exportsnapshotitem`)).affectedRows).toBe(0);
      await data.database.exec('reset role');
      await expire(data.database, expired.id);
      await data.database.exec('set role shopjob');
      const prune = () => data.manager.write(options(), context => pruneExportSnapshots(new PgTransactionAccess().database(context)));
      expect(await prune()).toBe(1000);
      expect(await prune()).toBe(3);
      expect(await prune()).toBe(0);
      expect((await data.database.query(`select id from voucher.exportsnapshot`)).rows).toEqual([{ id: active.id }]);
      expect((await data.database.query(`select count(*)::integer count from voucher.exportsnapshotitem`)).rows).toEqual([{ count: 1002 }]);
    } finally { await data.database.close(); }
  });
});

async function expire(database: PGlite, id: string) {
  // Fixture-only corruption requires owner privileges; application UPDATE is forbidden.
  await database.exec(`alter table voucher.exportsnapshot disable trigger voucherexportimmutable`);
  await database.query(`update voucher.exportsnapshot set captured_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1`, [id]);
  await database.exec(`alter table voucher.exportsnapshot enable trigger voucherexportimmutable`);
}
function options() { return { tenant: 'scope:test', scope: 'scope:test', membership: 'membership:test', actor: 'actor:test', trace: 'trace:test', operation: 'voucher.actionexports.create', signal: new AbortController().signal, deadline: Date.now() + 20_000 }; }
function input(id: string) { return { exportId: id, scope: 'scope:test', attempts: 1, signal: new AbortController().signal, deadline: Date.now() + 20_000 }; }
function runExport(renderer: PgVoucherExportProcess, objects: ObjectStore, value: ReturnType<typeof input>): Promise<void> {
  return new RunExport('voucherexport', objects).execute(value.exportId, {
    id: `job:${value.exportId}`, kind: 'voucherexport', scope: value.scope, payload: { export: value.exportId },
    authorization: {}, attempts: value.attempts, token: 1,
  }, value.signal, value.deadline, renderer);
}
function call<TKey extends OperationId>(context: WriteTransactionContext, kind: Kind, body: unknown): VoucherCall<TKey> {
  const access = { actor: { id: 'actor:test', membership: 'membership:test', target: 'console', credentialVersion: 1 },
    scope: { id: 'scope:test' }, organization: 'organization:test', accessVersion: 1, capabilityVersion: 1 } as AccessContext;
  return { input: { body }, context: { transaction: context, operation: operations[kind], security: { kind: 'session', access } },
    scope: 'scope:test', actor: 'actor:test', member: 'member:test', target: 'console', idempotency: `export:${kind}`, expectedVersion: 1, now: new Date() } as VoucherCall<TKey>;
}
async function fixture(count: number) {
  const database = new PGlite();
  await database.exec(`create schema voucher; create schema runtime; create schema access;
    create role shopapp; create role shopjob; grant usage on schema voucher,access to shopapp,shopjob;
    create function access.scope_allowed(text) returns boolean language sql as 'select $1=current_setting(''app.scope_id'',true)';
    create function voucher.guard_snapshot_item() returns trigger language plpgsql as $$begin raise exception 'VOUCHER_SNAPSHOT_IMMUTABLE'; end$$;
    ${schema} ${runtimeSchema}
    create table voucher.credentialpool(id text primary key,scope_id text,version integer,state text);
    create table voucher.credential(id text primary key,scope_id text,pool_id text,product_id text,state text,key_version text,created_at timestamptz,number_ciphertext text,secret_ciphertext text);
    create table voucher.issueorder(id text primary key,scope_id text);
    create table voucher.issuebatch(id text primary key,scope_id text,order_id text);
    create table voucher.issueitem(batch_id text,scope_id text,ordinal integer,state text,credential_id text,error_code text,updated_at timestamptz);
    create table voucher.voucher(id text primary key,scope_id text,credential_id text,number_masked text);
    create table voucher.actionbatch(id text primary key,scope_id text);
    create table voucher.actionitem(batch_id text,scope_id text,voucher_id text,state text,previous_state text,next_state text,error_code text,retryable boolean,updated_at timestamptz);
    insert into voucher.credentialpool values('pool:one','scope:test',1,'open'),('foreign','foreign',1,'open');
    insert into voucher.issueorder values('order:one','scope:test'),('foreign','foreign');
    insert into voucher.issuebatch values('batch:one','scope:test','order:one');
    insert into voucher.actionbatch values('action:one','scope:test'),('foreign','foreign');`);
  await database.query(`insert into voucher.credential select 'credential:'||lpad(n::text,5,'0'),'scope:test','pool:one','product:one','available','key:one',now()-interval '1 minute','cipher-number:'||n,'cipher-secret:'||n from generate_series(1,$1::integer) n`, [count]);
  await database.query(`insert into voucher.issueitem select 'batch:one','scope:test',n,'failed','credential:'||lpad(n::text,5,'0'),'RETRYABLE',now() from generate_series(1,$1::integer) n`, [count]);
  await database.query(`insert into voucher.voucher select 'voucher:'||lpad(n::text,5,'0'),'scope:test','credential:'||lpad(n::text,5,'0'),'****1234' from generate_series(1,$1::integer) n`, [count]);
  await database.query(`insert into voucher.actionitem select 'action:one','scope:test','voucher:'||lpad(n::text,5,'0'),'failed','active',null,'RETRYABLE',true,now() from generate_series(1,$1::integer) n`, [count]);
  const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
    const executed = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
    return { ...result(executed.rows), rowCount: executed.affectedRows ?? executed.rows.length };
  });
  const client = { query, release: () => undefined } as unknown as PoolClient;
  const pool: DatabasePool = { connect: async () => client, query: query as DatabasePool['query'], workload: () => pool, end: async () => undefined };
  const manager = new PgTransactionManager(pool);
  const exports = new PgExportPort(); const jobs = { create: vi.fn(async () => undefined) };
  const credentials = new PgCredentialRepository(jobs as unknown as JobPort, {} as ImportPort, exports);
  const issues = new PgIssueOrderRepository({} as ApprovalPort, {} as ApprovalReadPort, jobs as unknown as JobPort, exports);
  const actions = new PgActionBatchRepository(jobs as unknown as JobPort, exports);
  const watermark = new Date().toISOString();
  return { database, query, manager, jobs,
    read: (work: RuntimeExportWork) => manager.read(options(), context => readExportSnapshot(new PgTransactionAccess().database(context), work)),
    create: async (kind: Kind, reference?: string) => {
      const record = await manager.write(options(), context => kind === 'credential'
        ? credentials.export(call(context, kind, { pool: reference ?? 'pool:one', watermark, reason: '核对导出' }))
        : kind === 'issueorder' ? issues.export(call(context, kind, { order: reference ?? 'order:one', reason: '核对导出' }))
          : actions.export(call(context, kind, { batch: reference ?? 'action:one', reason: '核对导出' })));
      const work = await manager.read(options(), context => exports.work(context, record.body.id, 'scope:test', 'voucher'));
      if (!work) throw new Error('EXPORT_NOT_CREATED');
      return work;
    } };
}
function writer() {
  let content = ''; let path = ''; const abort = vi.fn(async () => undefined);
  const metadata = () => ({ reference: 'object:one', path, contentType: 'text/csv', scan: 'clean' as const,
    sha256: createHash('sha256').update(content).digest('hex'), size: Buffer.byteLength(content), retentionUntil: null, lockedUntil: null });
  const objects = { create: vi.fn(async (destination: string) => { path = destination; return { append: async (bytes: Uint8Array) => { content += new TextDecoder().decode(bytes); },
    complete: async () => metadata(), abort }; }), inspect: vi.fn(async () => metadata()), remove: vi.fn(async () => undefined) } as unknown as ObjectStore;
  return { objects, abort, csv: () => content };
}
