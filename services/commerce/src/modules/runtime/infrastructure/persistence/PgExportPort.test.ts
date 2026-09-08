import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { result, transactionManager, withReadTransaction, withWriteTransaction } from '../../../../test/TransactionFixture';
import { PgExportPort } from './PgExportPort';

const migration = readFileSync(new URL('../../../../../../../database/migrations/20260904011000_prepare_runtime_tasks.sql', import.meta.url), 'utf8');
const schema = migration.slice(migration.indexOf('create table runtime.exports('), migration.indexOf('create table runtime.deadletters('));

describe('runtime export ownership and one-time issuance SQL', () => {
  it('binds evidence and download consumption to the original actor, owner and scope', async () => {
    const data = await fixture();
    try {
      for (const [actor, scope, owner] of [
        ['actor:other', 'scope:test', 'voucher'],
        ['actor:test', 'scope:other', 'voucher'],
        ['actor:test', 'scope:test', 'reporting'],
      ]) {
        expect(await data.manager.read(options(actor!, scope!), (context) => data.exports.work(context, data.id, scope!, owner!))).toBeNull();
        expect(await data.manager.write(options(actor!, scope!), (context) => data.exports.take(context, data.id, scope!, owner!))).toBeNull();
      }
      const work = await withReadTransaction(data.query, (context) => data.exports.work(context, data.id, 'scope:test', 'voucher'));
      expect(work?.authorization.actor).toBe('actor:test');
      expect(JSON.stringify(work)).not.toContain('private/reference');
      const attempts = await Promise.all(Array.from({ length: 3 }, () => withWriteTransaction(data.query, (context) => data.exports.take(context, data.id, 'scope:test', 'voucher'))));
      expect(attempts.filter(Boolean)).toHaveLength(1);
      expect(attempts.find(Boolean)?.reference).toBe('private/reference');
    } finally {
      await data.database.close();
    }
  });

  it('does not consume expired files or leak their object reference in the read projection', async () => {
    const data = await fixture();
    try {
      await data.database.query(`update runtime.exports set download_expires_at=clock_timestamp()-interval '1 second' where id=$1`, [data.id]);
      const record = await withReadTransaction(data.query, (context) => data.exports.read(context, data.id, 'scope:test', 'voucher'));
      expect(record?.state).toBe('expired');
      expect(JSON.stringify(record)).not.toContain('private/reference');
      expect(await withWriteTransaction(data.query, (context) => data.exports.take(context, data.id, 'scope:test', 'voucher'))).toBeNull();
    } finally {
      await data.database.close();
    }
  });

  it('namespaces idempotency by actor and refuses changed requests under the same key', async () => {
    const data = await fixture();
    try {
      const request = { scope: 'scope:test', owner: 'voucher', kind: 'search', snapshot: { snapshot: 'snapshot:test' }, authorization: { actor: 'actor:test' }, actor: 'actor:test', idempotency: 'export:key' };
      const replay = await withWriteTransaction(data.query, (context) => data.exports.create(context, request));
      expect(replay.id).toBe(data.id);
      await expect(withWriteTransaction(data.query, (context) => data.exports.create(context, { ...request, snapshot: { snapshot: 'snapshot:other' } }))).rejects.toThrow('IDEMPOTENCY_CONFLICT');
      const another = await data.manager.write(options('actor:other', 'scope:test'), (context) => data.exports.create(context, { ...request, actor: 'actor:other', authorization: { actor: 'actor:other' } }));
      expect(another.id).not.toBe(data.id);
      await expect(withWriteTransaction(data.query, (context) => data.exports.create(context, { ...request, actor: 'actor:other' }))).rejects.toThrow('AUTHORIZATION_DENIED');
    } finally {
      await data.database.close();
    }
  });
});

function options(actor: string, scope: string) {
  return { tenant: scope, actor, scope, membership: 'membership:test', trace: 'trace:test', operation: 'voucher.exports.get', signal: new AbortController().signal, deadline: Date.now() + 10_000 };
}

async function fixture() {
  const database = new PGlite();
  await database.exec(`create schema runtime; ${schema}`);
  const query = async (sql: string, values?: readonly unknown[]) => {
    const executed = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
    return { ...result(executed.rows), rowCount: executed.affectedRows ?? executed.rows.length };
  };
  const exports = new PgExportPort();
  const created = await withWriteTransaction(query, (context) =>
    exports.create(context, { scope: 'scope:test', owner: 'voucher', kind: 'search', snapshot: { snapshot: 'snapshot:test' }, authorization: { actor: 'actor:test' }, actor: 'actor:test', idempotency: 'export:key' })
  );
  await withWriteTransaction(query, (context) => exports.claim(context, created.id, 'scope:test', 'voucher'));
  await withWriteTransaction(query, (context) =>
    exports.ready(context, created.id, 'scope:test', 'voucher', { reference: 'private/reference', sha256: 'a'.repeat(64), rows: 2, tokenHash: 'b'.repeat(64), expiresAt: new Date(Date.now() + 120_000).toISOString() })
  );
  return { database, query, exports, id: created.id, manager: transactionManager(query) };
}
