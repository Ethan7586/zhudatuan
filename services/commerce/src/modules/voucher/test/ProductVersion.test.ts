import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { PgTransactionManager } from '../../../adapter/database/PgTransactionManager';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { result } from '../../../test/TransactionFixture';
import { PgVoucherProductRepository } from '../infrastructure/persistence/PgVoucherProductRepository';
import { PgCredentialPoolRepository } from '../infrastructure/persistence/PgCredentialPoolRepository';

const original = readFileSync(new URL('../../../../../../database/migrations/20260904028200_prepare_voucher.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../../../../../database/migrations/20260904028700_prepare_voucher_versions.sql', import.meta.url), 'utf8');
const schema = original.slice(original.indexOf('create table voucher.product('), original.indexOf('create table voucher.stockrequest('));
const transition = original.slice(original.indexOf('create function voucher.guard_product_transition()'), original.indexOf('create function voucher.guard_pool_transition()'));
const policies = original.slice(original.indexOf('alter table voucher.product enable row level security;'), original.indexOf('alter table voucher.credentialpool enable row level security;'));
const versions = migration.slice(migration.indexOf('alter table voucher.product add constraint'), migration.indexOf('insert into runtime.schemaversion'));
const configuration = { customer: 'customer:one', name: '节日福利', faceMinor: 1000, currency: 'CNY', qualification: 'qualification:one',
  validity: { startsAt: '2026-01-01T00:00:00.000Z', expiresAt: '2099-01-01T00:00:00.000Z' }, activation: 'secret', approvalRequired: true };

describe('one immutable product version writer', () => {
  it('records create, pool attachment, enable, disable and revise with the same complete shape', async () => {
    const data = await fixture();
    try {
      const product = await data.create();
      await expect(data.enable(product.body.id, 1)).rejects.toThrow('VOUCHER_PRODUCT_INCOMPLETE');
      const pool = await data.pool(product.body.id);
      await data.enable(product.body.id, 2);
      await data.disable(product.body.id, 3);
      await data.revise(product.body.id, 4, pool.body.id);
      await data.enable(product.body.id, 5);
      const history = await data.history(product.body.id);
      expect(history.map(row => [row.version, row.snapshot.state, row.snapshot.faceMinor])).toEqual([
        [1, 'draft', 1000], [2, 'draft', 1000], [3, 'enabled', 1000], [4, 'disabled', 1000], [5, 'disabled', 2000], [6, 'enabled', 2000] ]);
      expect(history.every(row => row.changed_by === 'principal:operator')).toBe(true);
      expect(history.map(row => Object.keys(row.snapshot).sort())).toEqual(Array.from({ length: 6 }, () => Object.keys(history[0]!.snapshot).sort()));
      expect(history[0]!.snapshot).toMatchObject({ id: product.body.id, scopeId: 'scope:test', pool: null, activation: 'secret',
        qualification: 'qualification:one', approvalRequired: true, validity: { startsAt: expect.any(String), expiresAt: expect.any(String) } });
      expect(history[1]!.snapshot.pool).toBe(pool.body.id);
      const detail = await data.get(product.body.id);
      expect(detail.body.versions).toHaveLength(6);
      expect(detail.body.versions[0]?.version).toBe(6);
      expect(data.query.mock.calls.some(([sql]) => sql.startsWith('insert into voucher.productversion'))).toBe(false);
    } finally { await data.database.close(); }
  });

  it('does not create a revision after stale-version or reference validation failure', async () => {
    const data = await fixture();
    try {
      const product = await data.create(); const pool = await data.pool(product.body.id);
      await expect(data.enable(product.body.id, 1)).rejects.toThrow('VERSION_CONFLICT');
      data.validate.mockRejectedValueOnce(new Error('VOUCHER_CUSTOMER_INVALID'));
      await expect(data.revise(product.body.id, 2, pool.body.id)).rejects.toThrow('VOUCHER_CUSTOMER_INVALID');
      expect(await data.history(product.body.id)).toHaveLength(2);
      expect((await data.get(product.body.id)).body).toMatchObject({ version: 2, faceMinor: 1000, state: 'draft' });
    } finally { await data.database.close(); }
  });

  it('denies direct history insert/update/delete even while legitimate product writes can append versions', async () => {
    const data = await fixture();
    try {
      const product = await data.create();
      await data.database.exec(`set role shopapp; select set_config('app.scope_id','scope:test',false);`);
      for (const sql of [`update voucher.productversion set changed_by='forged'`, `delete from voucher.productversion`,
        `insert into voucher.productversion select * from voucher.productversion`]) await expect(data.database.query(sql)).rejects.toThrow(/permission denied/);
      const pool = await data.pool(product.body.id);
      await data.enable(product.body.id, 2);
      expect((await data.history(product.body.id)).at(-1)?.snapshot).toMatchObject({ pool: pool.body.id, state: 'enabled' });
      await data.database.exec('reset role');
      await expect(data.database.query(`update voucher.productversion set snapshot='{}'`)).rejects.toThrow('VOUCHER_SNAPSHOT_IMMUTABLE');
      await expect(data.database.query(`delete from voucher.productversion`)).rejects.toThrow('VOUCHER_SNAPSHOT_IMMUTABLE');
    } finally { await data.database.close(); }
  });

  it('rolls back product mutations without a trustworthy actor instead of generating anonymous history', async () => {
    const data = await fixture();
    try {
      const product = await data.create();
      await expect(data.database.query(`update voucher.product set name='unattributed',version=version+1 where id=$1`, [product.body.id])).rejects.toThrow('VOUCHER_VERSION_ACTOR_REQUIRED');
      expect((await data.get(product.body.id)).body.name).toBe(configuration.name);
      expect(await data.history(product.body.id)).toHaveLength(1);
    } finally { await data.database.close(); }
  });

  it('captures only an observable missing current revision at migration time without inventing intermediate history', async () => {
    const data = await fixture(false);
    try {
      const product = await data.create();
      await data.manager.write(options(), async () => {
        await data.database.query(`insert into voucher.productversion values($1,'scope:test',1,'{"name":"historical"}','principal:original',now()-interval '1 day')`, [product.body.id]);
        for (let version = 2; version <= 3; version++) await data.database.query(`update voucher.product set name=$2,version=$3 where id=$1`, [product.body.id, `revision ${version}`, version]);
      });
      const before = Date.now();
      await data.database.exec(versions);
      const history = await data.history(product.body.id);
      expect(history.map(row => row.version)).toEqual([1, 3]);
      expect(history[0]!.snapshot).toEqual({ name: 'historical' });
      expect(history[1]!.snapshot).toMatchObject({ version: 3, name: 'revision 3' });
      expect(history[1]!.changed_by).toBe('system:versioncapture');
      expect(new Date(history[1]!.changed_at).getTime()).toBeGreaterThanOrEqual(before);
      expect((await data.database.query(`select source_rows::integer,target_rows::integer,source_minor::integer,target_minor::integer from runtime.evidence`)).rows)
        .toEqual([{ source_rows: 1, target_rows: 1, source_minor: 1000, target_minor: 1000 }]);
    } finally { await data.database.close(); }
  });

  it('records zero capture totals when every observed current revision already exists', async () => {
    const data = await fixture(false);
    try {
      const product = await data.create();
      await data.database.query(`insert into voucher.productversion values($1,'scope:test',1,'{"name":"historical"}','principal:original',now())`, [product.body.id]);
      await data.database.exec(versions);
      expect((await data.database.query(`select source_rows::integer,target_rows::integer,source_minor::integer,target_minor::integer from runtime.evidence`)).rows)
        .toEqual([{ source_rows: 0, target_rows: 0, source_minor: 0, target_minor: 0 }]);
      expect((await data.history(product.body.id))[0]!.snapshot).toEqual({ name: 'historical' });
    } finally { await data.database.close(); }
  });
});

function options() { return { tenant: 'scope:test', scope: 'scope:test', membership: 'membership:operator', actor: 'principal:operator', trace: 'trace:test',
  operation: 'voucher.products.create', signal: new AbortController().signal, deadline: Date.now() + 20_000 }; }
async function fixture(upgrade = true) {
  const database = new PGlite();
  await database.exec(`create schema voucher; create schema access; create role shopapp; create role shopjob;
    create schema runtime;
    create table runtime.evidence(migration text primary key,source_rows bigint,target_rows bigint,source_minor numeric,target_minor numeric,
      check(source_rows=target_rows),check(source_minor=target_minor));
    create function runtime.record_migration_evidence(text,bigint,bigint,numeric,numeric,text,text) returns void language sql as
      'insert into runtime.evidence values($1,$2,$3,$4,$5)';
    grant usage on schema voucher,access to shopapp,shopjob;
    create function access.scope_allowed(text) returns boolean language sql as 'select $1=current_setting(''app.scope_id'',true)';
    create function voucher.guard_snapshot_item() returns trigger language plpgsql as $$begin raise exception 'VOUCHER_SNAPSHOT_IMMUTABLE'; end$$;
    ${schema} ${transition} ${policies}
    create table voucher.credential(id text primary key,pool_id text,product_id text,scope_id text,state text);
    grant select,insert,update on voucher.credentialpool to shopapp,shopjob; grant select on voucher.credential to shopapp,shopjob;
    ${upgrade ? versions : ''}`);
  const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
    const executed = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
    return { ...result(executed.rows), rowCount: executed.affectedRows ?? executed.rows.length };
  });
  const client = { query, release: () => undefined } as unknown as PoolClient;
  const pool: DatabasePool = { connect: async () => client, query: query as DatabasePool['query'], workload: () => pool, end: async () => undefined };
  const manager = new PgTransactionManager(pool);
  const validate = vi.fn(async () => undefined); const products = new PgVoucherProductRepository({ validate }); const pools = new PgCredentialPoolRepository();
  const call = (transaction: unknown, id?: string, version?: number, body: unknown = {}) => ({ input: { body, path: { productid: id } }, context: { transaction },
    scope: 'scope:test', actor: 'principal:operator', expectedVersion: version, now: new Date() });
  return { database, manager, query, validate,
    create: () => manager.write(options(), context => products.create(call(context, undefined, undefined, configuration) as never)),
    get: (id: string) => manager.read(options(), context => products.get(call(context, id) as never)),
    enable: (id: string, version: number) => manager.write(options(), context => products.enable(call(context, id, version) as never)),
    disable: (id: string, version: number) => manager.write(options(), context => products.disable(call(context, id, version) as never)),
    revise: (id: string, version: number, pool: string) => manager.write(options(), context => products.revise(call(context, id, version, { ...configuration, pool, faceMinor: 2000 }) as never)),
    pool: (product: string) => manager.write(options(), context => pools.create(call(context, undefined, undefined, {
      product, name: '节日卡号库', mode: 'generated', prefix: 'VC', capacity: 100 }) as never)),
    history: async (id: string) => (await database.query<{ version: number; snapshot: Record<string, unknown>; changed_by: string; changed_at: Date }>(
      `select version::integer,snapshot,changed_by,changed_at from voucher.productversion where product_id=$1 order by version`, [id])).rows };
}
