import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { PgTransactionManager } from '../../../adapter/database/PgTransactionManager';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { result } from '../../../test/TransactionFixture';
import type { ApprovalPort } from '../../approval/public';
import type { JobPort } from '../../runtime/public';
import { IssueTerms } from '../domain/value/IssueTerms';
import { PgIssueOrderRepository } from '../infrastructure/persistence/PgIssueOrderRepository';
import { PgIssueBatchProcess } from '../infrastructure/persistence/PgIssueBatchProcess';
import { PgVoucherRepository } from '../infrastructure/persistence/PgVoucherRepository';
import { PgActivationRate } from '../infrastructure/persistence/PgActivationRate';
import { PgActionBatchProcess } from '../infrastructure/persistence/PgActionBatchProcess';
import { VoucherTenderWriter } from '../infrastructure/persistence/VoucherTenderWriter';

const original = readFileSync(new URL('../../../../../../database/migrations/20260904028200_prepare_voucher.sql', import.meta.url), 'utf8');
const versionMigration = readFileSync(new URL('../../../../../../database/migrations/20260904028700_prepare_voucher_versions.sql', import.meta.url), 'utf8');
const termsMigration = readFileSync(new URL('../../../../../../database/migrations/20260904028800_prepare_voucher_terms.sql', import.meta.url), 'utf8');
const exportMigration = readFileSync(new URL('../../../../../../database/migrations/20260904028600_prepare_voucher_exports.sql', import.meta.url), 'utf8');
const schema = original.slice(original.indexOf('create table voucher.product('), original.indexOf('insert into voucher.product('));
const productGuard = original.slice(original.indexOf('create function voucher.guard_product_transition()'), original.indexOf('create function voucher.guard_pool_transition()'));
const issueGuard = original.slice(original.indexOf('create function voucher.guard_issueorder_transition()'), original.indexOf('create function voucher.guard_credential_transition()'));
const versions = versionMigration.slice(versionMigration.indexOf('alter table voucher.product add constraint'), versionMigration.indexOf('select runtime.record_migration_evidence'));
const terms = termsMigration.slice(termsMigration.indexOf('alter table voucher.issueorder add constraint'), termsMigration.indexOf('select runtime.record_migration_evidence'));
const exports = exportMigration.slice(exportMigration.indexOf('create table voucher.exportsnapshot('), exportMigration.indexOf('select runtime.record_migration_evidence'));
const value = { product: 'product:one', productVersion: 2, pool: 'pool:one', faceMinor: 1000, currency: 'CNY', qualification: 'qualification:one',
  activation: 'secret' as const, startsAt: '2026-01-01T00:00:00.000Z', expiresAt: '2099-01-01T00:00:00.000Z' };

describe('frozen issuance terms', () => {
  it('reclaims expired holds through the shared writer and records exactly one restoration in the timeline', async () => {
    const data = await fixture();
    try {
      await data.submit(); await data.approve(); await data.issue();
      const active = await data.activate();
      await data.manager.write(options(), context => new VoucherTenderWriter().reserve({ context, scope: 'scope:test',
        voucher: active.body.id, owner: 'order:checkout', member: null, amountMinor: 100, ttlSeconds: 60,
        idempotency: 'hold:expired', now: new Date(Date.now() - 120_000), actor: 'principal:consumer' }));
      await data.maintain(); await data.maintain();
      expect((await data.database.query(`select state from voucher.tenderhold`)).rows).toEqual([{ state: 'expired' }]);
      expect((await data.database.query(`select state,remaining_minor::integer from voucher.voucher where id=$1`, [active.body.id])).rows)
        .toEqual([{ state: 'active', remaining_minor: 1000 }]);
      expect((await data.database.query(`select previous_state,next_state from voucher.timeline where reason='holdexpiry'`)).rows)
        .toEqual([{ previous_state: 'held', next_state: 'active' }]);
    } finally { await data.database.close(); }
  });
  it('validates money precision and validity without reading mutable product state', () => {
    const terms = new IssueTerms(value);
    expect(terms.amount(3)).toBe(3000);
    expect(Object.isFrozen(terms.value)).toBe(true);
    for (const quantity of [0, -1, 0.5, Number.MAX_SAFE_INTEGER]) expect(() => terms.amount(quantity)).toThrow('VALIDATION_FAILED');
    expect(() => new IssueTerms({ ...value, faceMinor: 1.1 })).toThrow('VOUCHER_PRODUCT_INCOMPLETE');
    expect(() => terms.assertValidity(new Date('2025-01-01'), new Date('2026-02-01'), new Date('2026-01-01'))).toThrow('VOUCHER_PRODUCT_INCOMPLETE');
  });

  it('preserves approved value and activation across a product revision and a partially failed issuance retry', async () => {
    const data = await fixture();
    try {
      await data.submit();
      expect(data.request).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requesterId: 'membership:maker', amountMinor: 3000, currency: 'CNY',
        subject: expect.objectContaining({ snapshot: expect.objectContaining({ terms: expect.objectContaining({ productVersion: 2, faceMinor: 1000, activation: 'secret' }) }) }) }));
      await data.revise();
      await data.approve();
      await data.issue();
      expect(await data.vouchers()).toEqual([{ amount: 1000, state: 'allocated' }, { amount: 1000, state: 'allocated' }]);
      await data.addCredential(3);
      await data.retry();
      await data.issue();
      expect(await data.vouchers()).toEqual(Array.from({ length: 3 }, () => ({ amount: 1000, state: 'allocated' })));
      expect(data.post.mock.calls.map(([, entry]) => entry.amountMinor)).toEqual([2000, 1000]);
      await data.issue();
      expect(data.post).toHaveBeenCalledTimes(2);
      // Product is now disabled/automatic, but already issued secret cards keep
      // their original activation method and consumer entitlement.
      const activated = await data.activate();
      expect(activated.body).toMatchObject({ state: 'active', remainingMinor: 1000, currency: 'CNY' });
    } finally { await data.database.close(); }
  });

  it('does not allocate approved credentials after their pool closes', async () => {
    const data = await fixture();
    try {
      await data.submit(); await data.approve();
      await data.database.exec(`update voucher.credentialpool set state='closed',version=version+1 where id='pool:one'`);
      await data.issue();
      expect(await data.vouchers()).toEqual([]);
      expect((await data.database.query(`select state,error_code,retryable from voucher.issueitem`)).rows).toEqual(Array.from({ length: 3 }, () => ({
        state: 'failed', error_code: 'VOUCHER_POOL_CLOSED', retryable: false })));
      expect(data.post).not.toHaveBeenCalled();
      await expect(data.retry()).rejects.toThrow('VOUCHER_BATCH_NOT_RETRYABLE');
    } finally { await data.database.close(); }
  });

  it('does not change issued secret cards to automatic activation when a revised product is enabled', async () => {
    const data = await fixture();
    try {
      await data.submit(); await data.approve(); await data.issue(); await data.revise();
      await data.manager.write(options(), async () => data.database.exec(`update voucher.product set state='enabled',version=version+1 where id='product:one'`));
      await data.maintain();
      expect(await data.vouchers()).toEqual([{ amount: 1000, state: 'allocated' }, { amount: 1000, state: 'allocated' }]);
    } finally { await data.database.close(); }
  });

  it('does not issue already expired benefits even when approval arrives late', async () => {
    const data = await fixture();
    try {
      await data.submit(); await data.approve();
      const advanced = Date.now() + 31 * 86_400_000;
      const clock = vi.spyOn(Date, 'now').mockReturnValue(advanced);
      try { await data.issue(); } finally { clock.mockRestore(); }
      expect(await data.vouchers()).toEqual([]);
      expect(data.post).not.toHaveBeenCalled();
      expect((await data.database.query(`select state,error_code,retryable from voucher.issueitem`)).rows).toEqual(Array.from({ length: 3 }, () => ({
        state: 'failed', error_code: 'VOUCHER_STATE_INVALID', retryable: false })));
    } finally { await data.database.close(); }
  });

  it('rejects an unfrozen submission, then forbids changing either terms or submitted request fields', async () => {
    const data = await fixture();
    try {
      await expect(data.database.query(`update voucher.issueorder set state='submitted',approval_instance_id='approval:forged',version=2 where id='order:one'`)).rejects.toThrow('VOUCHER_ISSUE_TERMS_REQUIRED');
      await data.submit();
      await expect(data.database.query(`update voucher.issueterms set face_minor=9999`)).rejects.toThrow('VOUCHER_SNAPSHOT_IMMUTABLE');
      await expect(data.database.query(`delete from voucher.issueterms`)).rejects.toThrow('VOUCHER_SNAPSHOT_IMMUTABLE');
      for (const change of [`quantity=4`, `recipient_snapshot='member:other'`, `expires_at=expires_at+interval '1 day'`])
        await expect(data.database.query(`update voucher.issueorder set ${change},version=version+1 where id='order:one'`)).rejects.toThrow('VOUCHER_ISSUE_FROZEN');
      await data.database.exec(`set role shopapp; select set_config('app.scope_id','other',false);`);
      expect((await data.database.query(`select * from voucher.issueterms`)).rows).toEqual([]);
      await data.database.exec('reset role; set role shopjob');
      await expect(data.database.query(`insert into voucher.issueterms select * from voucher.issueterms`)).rejects.toThrow(/permission denied/);
    } finally { await data.database.close(); }
  });

  it.each(['disabled', 'foreign', 'validity'] as const)('refuses %s product terms before requesting approval', async condition => {
    const data = await fixture();
    try {
      if (condition === 'disabled') await data.revise();
      if (condition === 'foreign') await data.database.query(`update voucher.issueorder set customer_id='customer:other',version=2 where id='order:one'`);
      if (condition === 'validity') await data.database.query(`update voucher.issueorder set expires_at=now()+interval '90 days',version=2 where id='order:one'`);
      await expect(data.submit()).rejects.toThrow(condition === 'foreign' ? 'VOUCHER_APPROVAL_REQUIRED' : 'VOUCHER_PRODUCT_INCOMPLETE');
      expect(data.request).not.toHaveBeenCalled();
      expect((await data.database.query(`select * from voucher.issueterms`)).rows).toEqual([]);
    } finally { await data.database.close(); }
  });

  it('rolls back a frozen terms row when approval is unavailable', async () => {
    const data = await fixture();
    try {
      data.request.mockRejectedValueOnce(new Error('APPROVAL_TEMPLATE_DISABLED'));
      await expect(data.submit()).rejects.toThrow('APPROVAL_TEMPLATE_DISABLED');
      expect((await data.database.query(`select * from voucher.issueterms`)).rows).toEqual([]);
      expect((await data.database.query(`select state from voucher.issueorder`)).rows).toEqual([{ state: 'draft' }]);
    } finally { await data.database.close(); }
  });
});

function options() { return { tenant: 'scope:test', scope: 'scope:test', membership: 'membership:maker', actor: 'principal:maker', trace: 'trace:test',
  operation: 'voucher.issueorders.submit', signal: new AbortController().signal, deadline: Date.now() + 20_000 }; }
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
async function fixture() {
  const database = new PGlite();
  await database.exec(`create schema voucher; create schema access; create role shopapp; create role shopjob;
    grant usage on schema voucher,access to shopapp,shopjob;
    create function access.scope_allowed(text) returns boolean language sql as 'select $1=current_setting(''app.scope_id'',true)';
    ${schema} ${productGuard} ${issueGuard} ${versions} ${terms} ${exports}`);
  const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
    // The financial and outbox adapters are separate ports/concerns; all Voucher
    // SQL and transaction control below execute against PostgreSQL, not stubs.
    if (sql.includes('insert into runtime.outbox')) return result([]);
    const executed = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
    return { ...result(executed.rows), rowCount: executed.affectedRows ?? executed.rows.length };
  });
  const client = { query, release: () => undefined } as unknown as PoolClient;
  const pool: DatabasePool = { connect: async () => client, query: query as DatabasePool['query'], workload: () => pool, end: async () => undefined };
  const manager = new PgTransactionManager(pool);
  await manager.write(options(), async () => database.exec(`
    insert into voucher.product values('product:one','VP1','scope:test','customer:one','节日福利',1000,'CNY','qualification:one',null,now()-interval '1 day',now()+interval '30 days','secret',true,'draft',1,now(),now());
    insert into voucher.credentialpool values('pool:one','CP1','scope:test','product:one','卡号库','generated','VC',100,0,'open',1,now(),now());
    update voucher.product set pool_id='pool:one',state='enabled',version=2;
    insert into voucher.stockrequest values('stock:one','SR1','scope:test','customer:one','product:one','pool:one',3,'员工福利','approved','approval:stock','principal:maker',2,now(),now());
    insert into voucher.issueorder values('order:one','IO1','scope:test','customer:one','product:one','stock:one',3,'benefit','claim',now()-interval '1 hour',now()+interval '10 days','member:one','员工福利','draft',null,'principal:maker',1,now(),now());`));
  const addCredential = (number: number) => database.query(`insert into voucher.credential(id,scope_id,pool_id,product_id,number_ciphertext,secret_ciphertext,number_fingerprint,secret_fingerprint,number_masked,key_version,state,version,created_at,updated_at)
    values($1,'scope:test','pool:one','product:one','cipher-number','cipher-secret',$2,$3,'****1234','key:one','available',1,now(),now())`,
  [`credential:${number}`, hash(`number:${number}`), hash(`secret:${number}`)]);
  await addCredential(1); await addCredential(2);
  const request = vi.fn<ApprovalPort['request']>(async () => ({ instanceId: 'approval:issue', state: 'pending', templateId: 'template:one', templateVersion: 1, version: 1, requestedAt: new Date().toISOString() }));
  const jobs = { create: vi.fn(), progress: vi.fn() } as unknown as JobPort;
  const post = vi.fn<import('../../finance/public').VoucherAccountingPort['post']>(async () => 'journal:one');
  const repository = new PgIssueOrderRepository({ request, cancel: vi.fn(), consume: vi.fn() }, {} as never, jobs, {} as never);
  const process = new PgIssueBatchProcess(manager, jobs, { post });
  const readVersion = async (table: 'issueorder' | 'issuebatch', id: string) => Number((await database.query<{ version: number }>(`select version::integer from voucher.${table} where id=$1`, [id])).rows[0]!.version);
  return { database, query, manager, request, post, addCredential,
    submit: async () => { const expectedVersion = await readVersion('issueorder', 'order:one'); return manager.write(options(), context => repository.submit({
      input: { path: { orderid: 'order:one' } }, context: { transaction: context }, scope: 'scope:test', actor: 'principal:maker', expectedVersion, now: new Date() } as never)); },
    approve: () => manager.write(options(), async () => database.exec(`update voucher.issueorder set state='approved',version=version+1 where id='order:one';
      insert into voucher.issuebatch(id,order_id,scope_id,state,requested,processed,succeeded,failed,retryable,version,created_at,updated_at)
        values('batch:one','order:one','scope:test','queued',3,0,0,0,0,1,now(),now());
      insert into voucher.issueitem select 'batch:one','scope:test',ordinal,null,'queued',null,false,'batch:one:'||ordinal,now() from generate_series(1,3) ordinal;`)),
    revise: () => manager.write(options(), async () => database.exec(`update voucher.product set face_minor=9000,activation='automatic',state='disabled',version=version+1 where id='product:one'`)),
    retry: async () => { const expectedVersion = await readVersion('issuebatch', 'batch:one'); return manager.write(options(), context => repository.retry({
      input: { path: { batchid: 'batch:one' } }, context: { transaction: context }, scope: 'scope:test', actor: 'principal:maker', expectedVersion, idempotency: 'retry:key' } as never)); },
    issue: () => process.issue({ job: 'job:one', batch: 'batch:one', scope: 'scope:test', signal: new AbortController().signal, deadline: Date.now() + 20_000 }),
    maintain: () => new PgActionBatchProcess(manager, jobs).maintain({ job: 'job:maintain', signal: new AbortController().signal, deadline: Date.now() + 20_000 }),
    vouchers: async () => (await database.query(`select initial_minor::integer amount,state from voucher.voucher order by id`)).rows,
    activate: () => manager.write(options(), context => new PgVoucherRepository(new PgActivationRate(), {} as never, {} as never, { post }).activateSecret({
      context: { transaction: context }, scope: 'scope:test', actor: 'principal:consumer', member: 'member:one', target: 'storefront', now: new Date() } as never,
    { secretFingerprint: hash('secret:1'), numberFingerprint: null })) };
}
