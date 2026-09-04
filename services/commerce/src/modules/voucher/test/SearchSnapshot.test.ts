import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
import type { OperationId } from '@shop/contract';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { ObjectStore } from '../../runtime/public/ObjectPort';
import { result, transactionManager, withWriteTransaction } from '../../../test/TransactionFixture';
import type { ExportPort, JobPort, RuntimeExportWork } from '../../runtime/public';
import type { VoucherCall } from '../application/port/VoucherCall';
import type { CredentialProtector } from '../application/port/CredentialProtector';
import { PgVoucherSearch } from '../infrastructure/persistence/PgVoucherSearch';
import { PgVoucherExport } from '../infrastructure/persistence/PgVoucherExport';
import { PgVoucherExportProcess } from '../infrastructure/persistence/PgVoucherExportProcess';
import { PreparedVoucherSearch } from '../application/service/PreparedVoucherSearch';
import type { SearchFilter } from '../application/port/SearchFilter';
import { DomainError } from '../../../foundation/domain/DomainError';
import type { AccessContext } from '../../../foundation/security/AccessContext';
import { RunExport } from '../../runtime/application/process/RunExport';

const migration = readFileSync(new URL('../../../../../../database/migrations/20260904028200_prepare_voucher.sql', import.meta.url), 'utf8');
const snapshotSchema = migration.slice(migration.indexOf('create table voucher.searchsnapshot('), migration.indexOf('alter table voucher.actionbatch add constraint voucher_actionbatch_snapshot'));

describe('frozen voucher search exports', () => {
  it('uses literal wildcard text consistently and never persists a full lookup number', async () => {
    const data = await fixture(1);
    try {
      const repository = new PgVoucherSearch();
      const service = new PreparedVoucherSearch(repository, { fingerprint: vi.fn(async () => 'f'.repeat(64)) });
      const wildcard = await service.prepare({ query: { query: '%' } } as never, 'mall:one');
      const read = await withWriteTransaction(data.query, context => repository.read(call(context, { query: { query: '%' } }), wildcard));
      const facets = await withWriteTransaction(data.query, context => repository.facets(call(context, { query: { query: '%' } }), wildcard));
      expect(read.body.count).toBe(0);
      expect(facets.body.states).toEqual([]);
      expect((await data.snapshot(wildcard)).body.count).toBe(0);
      const lookup = await service.prepare({ body: { filter: { query: 'VC001234' } } } as never, 'mall:one');
      const frozen = await data.snapshot(lookup);
      expect(frozen.body.count).toBe(1);
      const persisted = JSON.stringify((await data.database.query(`select filter from voucher.searchsnapshot where id=$1`, [frozen.body.id])).rows);
      expect(persisted).not.toContain('VC001234');
      expect(persisted).toContain('f'.repeat(64));
    } finally { await data.database.close(); }
  });
  it('copies masked fields once and renders multiple pages without reading changed vouchers', async () => {
    const data = await fixture(1002);
    try {
      const frozen = await data.snapshot();
      expect(frozen.body.count).toBe(1002);
      await data.database.exec(`update voucher.voucher set remaining_minor=42,state='disabled',version=2;
        update voucher.holder set member_id='member:changed';`);
      const work = await data.export(frozen.body.id);
      const output = writer();
      const ready = vi.fn();
      const exports = { claim: vi.fn(async () => work), ready, fail: vi.fn() } as unknown as ExportPort;
      const assert = vi.fn(async () => undefined);
      await runExport(new PgVoucherExportProcess(transactionManager(data.query), exports, {} as CredentialProtector, 3, { assert }), output.objects, input());
      const csv = output.csv();
      expect(csv.split('\r\n')).toHaveLength(1004);
      expect(csv).toContain('"member:one","1000","CNY","active"');
      expect(csv).not.toContain('member:changed');
      expect(csv).not.toContain('"disabled"');
      expect(csv).not.toContain('private-number');
      expect(csv).not.toContain('private-secret');
      expect(csv.split('\r\n')[0]).toContain('"导出编号","申请人","申请时间"');
      expect(csv.match(/"export:one","actor:one"/g)).toHaveLength(1002);
      expect(ready).toHaveBeenCalledWith(expect.anything(), 'export:one', 'mall:one', 'voucher', expect.objectContaining({ rows: 1002 }));
      expect(data.query.mock.calls.filter(([sql]) => sql.startsWith('select item.ordinal'))).toHaveLength(3);
      expect(assert).toHaveBeenCalledTimes(5);
      expect(output.objects.create).toHaveBeenCalledWith(expect.stringMatching(/^tenant\/[a-f0-9]{64}\/confidential\/voucher\/[a-f0-9]{32}\.csv$/), 'text/csv');
    } finally { await data.database.close(); }
  });

  it.each(['another actor', 'another scope', 'expired'] as const)('refuses %s snapshots before creating any export or job', async denied => {
    const data = await fixture(1);
    try {
      const frozen = await data.snapshot();
      if (denied === 'expired') await data.database.query(`update voucher.searchsnapshot set expires_at=created_at+interval '1 millisecond' where id=$1`, [frozen.body.id]);
      const create = vi.fn();
      const job = vi.fn();
      const repository = new PgVoucherExport({ create } as unknown as ExportPort, { create: job } as unknown as JobPort);
      await expect(withWriteTransaction(data.query, context => repository.search({ ...call<'voucher.searchexports.create'>(context,
        { body: { snapshot: frozen.body.id, reason: '核对券卡' } }), ...(denied === 'another actor' ? { actor: 'actor:other' } : denied === 'another scope' ? { scope: 'mall:other' } : {}) })))
        .rejects.toThrow(denied === 'expired' ? 'VOUCHER_EXPORT_NOT_READY' : 'RESOURCE_NOT_FOUND');
      expect(create).not.toHaveBeenCalled();
      expect(job).not.toHaveBeenCalled();
    } finally { await data.database.close(); }
  });

  it('rejects mutation or cross-scope snapshot items at the database boundary', async () => {
    const data = await fixture(2);
    try {
      const frozen = await data.snapshot();
      await expect(data.database.query(`update voucher.searchsnapshotitem set remaining_minor=0 where snapshot_id=$1`, [frozen.body.id])).rejects.toThrow('VOUCHER_SNAPSHOT_IMMUTABLE');
      await data.database.query(`delete from voucher.searchsnapshotitem where snapshot_id=$1 and ordinal=2`, [frozen.body.id]);
      await expect(data.database.query(`insert into voucher.searchsnapshotitem select snapshot_id,'mall:other','voucher:00002',ordinal+1,
        number_masked,product_id,member_id,remaining_minor,currency,state,starts_at,expires_at,voucher_version from voucher.searchsnapshotitem where snapshot_id=$1`,
      [frozen.body.id])).rejects.toThrow(/foreign key/);
    } finally { await data.database.close(); }
  });

  it('aborts an incomplete export and never publishes it as ready', async () => {
    const data = await fixture(2);
    try {
      const frozen = await data.snapshot();
      const work = await data.export(frozen.body.id);
      await data.database.query(`delete from voucher.searchsnapshotitem where snapshot_id=$1 and ordinal=2`, [frozen.body.id]);
      const output = writer();
      const ready = vi.fn();
      const fail = vi.fn();
      const exports = { claim: vi.fn(async () => work), ready, fail } as unknown as ExportPort;
      await expect(runExport(new PgVoucherExportProcess(transactionManager(data.query), exports, {} as CredentialProtector, 3, { assert: vi.fn() }), output.objects, input())).rejects.toThrow('EXPORT_ROW_COUNT_MISMATCH');
      expect(output.abort).toHaveBeenCalledOnce();
      expect(ready).not.toHaveBeenCalled();
      expect(fail).toHaveBeenCalledWith(expect.anything(), 'export:one', 'mall:one', 'voucher', false);
    } finally { await data.database.close(); }
  });

  it.each([1, 3, 4])('fails closed when authorization is revoked at check %s', async denyAt => {
    const data = await fixture(2);
    try {
      const frozen = await data.snapshot();
      const work = await data.export(frozen.body.id);
      const output = writer();
      const ready = vi.fn();
      const fail = vi.fn();
      const exports = { claim: vi.fn(async () => work), ready, fail } as unknown as ExportPort;
      let checks = 0;
      const assert = vi.fn(async () => { if (++checks === denyAt) throw new DomainError('AUTHORIZATION_DENIED'); });
      await expect(runExport(new PgVoucherExportProcess(transactionManager(data.query), exports, {} as CredentialProtector, 3, { assert }), output.objects, input())).rejects.toThrow('AUTHORIZATION_DENIED');
      expect(ready).not.toHaveBeenCalled();
      expect(fail).toHaveBeenCalledWith(expect.anything(), 'export:one', 'mall:one', 'voucher', true);
      if (denyAt === 1) expect(output.objects.create).not.toHaveBeenCalled();
      else if (denyAt === 4) expect(output.objects.remove).toHaveBeenCalledWith('object:one');
      else expect(output.abort).toHaveBeenCalledOnce();
    } finally { await data.database.close(); }
  });
});

function input() { return { exportId: 'export:one', scope: 'mall:one', attempts: 1, signal: new AbortController().signal, deadline: Date.now() + 10_000 }; }
function runExport(renderer: PgVoucherExportProcess, objects: ObjectStore, value: ReturnType<typeof input>): Promise<void> {
  return new RunExport('voucherexport', objects).execute(value.exportId, {
    id: `job:${value.exportId}`, kind: 'voucherexport', scope: value.scope, payload: { export: value.exportId },
    authorization: {}, attempts: value.attempts, token: 1,
  }, value.signal, value.deadline, renderer);
}
function call<TKey extends OperationId>(transaction: ReadTransactionContext, input: unknown): VoucherCall<TKey> {
  const access = { actor: { id: 'actor:one', membership: 'membership:one', target: 'console', credentialVersion: 1 },
    scope: { id: 'mall:one' }, organization: 'organization:one', accessVersion: 1, capabilityVersion: 1 } as AccessContext;
  return { input, context: { transaction, operation: 'voucher.searchexports.create', security: { kind: 'session', access } }, scope: 'mall:one', actor: 'actor:one', member: 'member:one', target: 'console', idempotency: 'export:key', now: new Date() } as VoucherCall<TKey>;
}
async function fixture(count: number) {
  const database = new PGlite();
  await database.exec(`create schema voucher;
    create table voucher.voucher(id text primary key,scope_id text,number_masked text,product_id text,credential_id text,holder_id text,
      remaining_minor bigint,currency text,state text,starts_at timestamptz,expires_at timestamptz,version integer,updated_at timestamptz,
      initial_minor bigint default 1000,created_at timestamptz default now(),number_fingerprint text default repeat('f',64));
    create table voucher.product(id text primary key,name text,customer_id text);
    create table voucher.credential(id text primary key,pool_id text,number_ciphertext text,secret_ciphertext text);
    create table voucher.holder(id text primary key,member_id text,state text);
    ${snapshotSchema}
    insert into voucher.holder values('holder:one','member:one','bound');
    insert into voucher.product values('product:one','节日福利','customer:one');`);
  await database.query(`insert into voucher.credential select 'credential:'||ordinal,'pool:one','private-number','private-secret' from generate_series(1,$1::integer) ordinal`, [count]);
  await database.query(`insert into voucher.voucher(id,scope_id,number_masked,product_id,credential_id,holder_id,remaining_minor,currency,state,starts_at,expires_at,version,updated_at)
    select 'voucher:'||lpad(ordinal::text,5,'0'),'mall:one','****'||lpad(ordinal::text,4,'0'),'product:one','credential:'||ordinal,
    'holder:one',1000,'CNY','active',now()-interval '1 day',now()+interval '30 days',1,now()-interval '1 second' from generate_series(1,$1::integer) ordinal`, [count]);
  const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
    const executed = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
    return { ...result(executed.rows), rowCount: executed.affectedRows ?? executed.rows.length };
  });
  return { database, query,
    snapshot: (filter: SearchFilter = { criteria: {}, query: null, fingerprint: null }) => withWriteTransaction(query, context => new PgVoucherSearch().snapshot(call(context, { body: { filter: {} } }), filter)),
    export: async (snapshot: string): Promise<RuntimeExportWork> => {
      let captured: RuntimeExportWork | undefined;
      const create: ExportPort['create'] = async (_context, value) => {
        captured = { id: 'export:one', scope: value.scope, kind: value.kind, snapshot: value.snapshot, authorization: value.authorization };
        return { id: 'export:one', kind: value.kind, state: 'queued', expiresAt: new Date(Date.now() + 60_000).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      };
      await withWriteTransaction(query, context => new PgVoucherExport({ create } as ExportPort, { create: vi.fn() } as unknown as JobPort)
        .search(call(context, { body: { snapshot, reason: '核对券卡' } })));
      if (!captured) throw new Error('EXPORT_NOT_CREATED');
      return captured;
    } };
}
function writer() {
  let content = '';
  let path = '';
  const abort = vi.fn(async () => undefined);
  const metadata = () => ({ reference: 'object:one', path, contentType: 'text/csv', scan: 'clean' as const,
    sha256: createHash('sha256').update(content).digest('hex'), size: Buffer.byteLength(content), retentionUntil: null, lockedUntil: null });
  const objects = { create: vi.fn(async (destination: string) => { path = destination; return { append: async (bytes: Uint8Array) => { content += new TextDecoder().decode(bytes); },
    complete: async () => metadata(), abort }; }), inspect: vi.fn(async () => metadata()), remove: vi.fn(async () => undefined) } as unknown as ObjectStore;
  return { objects, abort, csv: () => content };
}
