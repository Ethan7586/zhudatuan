import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../../../../../database/migrations/20260904029000_publish_voucher_redemption.sql', import.meta.url), 'utf8');
const gate = migration.slice(migration.indexOf('do $precondition$'), migration.indexOf('-- Retired catalog'));

describe('redemption event hard cutover', () => {
  it('requires historical redemption context evidence instead of deriving old store and scope from current organization data', async () => {
    const database = await fixture();
    try {
      const facts = readFileSync(new URL('../../../../../../database/migrations/20260904029300_publish_voucher_refunds.sql', import.meta.url), 'utf8');
      await database.exec(`insert into runtime.schemaversion values('20260904029200'); create schema voucher; create table voucher.redemption(id text);
        insert into voucher.redemption values('redemption:historical')`);
      await expect(database.exec(facts.slice(facts.indexOf('do $precondition$'), facts.indexOf('alter table voucher.redemption'))))
        .rejects.toThrow('VOUCHER_REDEMPTION_CONTEXT_EVIDENCE_REQUIRED');
      expect((await database.query('select id from voucher.redemption')).rows).toEqual([{ id: 'redemption:historical' }]);
    } finally { await database.close(); }
  });
  it('refuses to invent historical payer bindings from the current holder', async () => {
    const database = await fixture();
    try {
      const refunds = readFileSync(new URL('../../../../../../database/migrations/20260904029100_prepare_voucher_refunds.sql', import.meta.url), 'utf8');
      await database.exec(`insert into runtime.schemaversion values('20260904029000'); create schema voucher; create table voucher.redemption(id text);
        insert into voucher.redemption values('redemption:historical')`);
      await expect(database.exec(refunds.slice(refunds.indexOf('do $precondition$'), refunds.indexOf('alter table voucher.holder'))))
        .rejects.toThrow('VOUCHER_REDEMPTION_HOLDER_EVIDENCE_REQUIRED');
      expect((await database.query(`select id from voucher.redemption`)).rows).toEqual([{ id: 'redemption:historical' }]);
    } finally { await database.close(); }
  });
  it.each(['outbox', 'inbox'] as const)('refuses cutover while the old %s contains unprocessed work without deleting it', async table => {
    const database = await fixture();
    try {
      await database.exec(`insert into runtime.${table} values('voucher.redeemed',1,null)`);
      await expect(database.exec(gate)).rejects.toThrow('VOUCHER_REDEMPTION_EVENT_DRAIN_REQUIRED');
      expect((await database.query(`select count(*)::integer count from runtime.${table}`)).rows).toEqual([{ count: 1 }]);
    } finally { await database.close(); }
  });

  it('preserves processed historical events after the old queue is drained', async () => {
    const database = await fixture();
    try {
      await database.exec(`insert into runtime.outbox values('voucher.redeemed',1,now()); insert into runtime.inbox values('voucher.redeemed',1,now())`);
      await database.exec(gate);
      expect((await database.query(`select event_version from runtime.outbox`)).rows).toEqual([{ event_version: 1 }]);
      expect((await database.query(`select event_version from runtime.inbox`)).rows).toEqual([{ event_version: 1 }]);
    } finally { await database.close(); }
  });
});

async function fixture() {
  const database = new PGlite();
  await database.exec(`create schema runtime;
    create table runtime.schemaversion(version text); insert into runtime.schemaversion values('20260904028900');
    create table runtime.outbox(event_type text,event_version integer,published_at timestamptz);
    create table runtime.inbox(event_type text,event_version integer,processed_at timestamptz);`);
  return database;
}
