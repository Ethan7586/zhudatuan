import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../../database/migrations/20260904028200_prepare_voucher.sql', import.meta.url), 'utf8');
const start = migration.indexOf('create temporary table voucherpermissionmap(');
const end = migration.indexOf('insert into access.separationrule(', start);
assert.ok(start >= 0 && end > start, 'voucher permission cutover section must exist');
const permissions = migration.slice(start, end);
const codes = [...new Set([...permissions.matchAll(/'(voucher\.[a-z.]+|reporting\.export\.[a-z]+)'/g)].map(match => match[1]!))];

test('voucher cutover keeps historical credentials intact until rewrapping and business references are verified', async () => {
  const database = new PGlite();
  try {
    await database.exec(`create schema runtime; create table runtime.schemaversion(version text primary key);
      insert into runtime.schemaversion values('20260904028100'); create schema voucher;
      create table voucher.program(id text primary key); create table voucher.cardpool(id text primary key);
      create table voucher.card(id text primary key,ciphertext text not null); create table voucher.voucher(id text primary key);
      insert into voucher.card values('card:historical','existing-encrypted-value');`);
    await assert.rejects(database.exec(migration), /VOUCHER_CUTOVER_EVIDENCE_REQUIRED/);
    await database.exec('rollback');
    assert.deepEqual((await database.query(`select * from voucher.card`)).rows, [{ id: 'card:historical', ciphertext: 'existing-encrypted-value' }]);
    assert.deepEqual((await database.query(`select version from runtime.schemaversion`)).rows, [{ version: '20260904028100' }]);
  } finally { await database.close(); }
});

test('voucher permission hardcut collapses many-to-one grants with deny precedence', async () => {
  const database = await fixture();
  try {
    await database.exec(`insert into access.rolepermission values('role:one','voucher.binding.read','allow'),('role:one','voucher.history.read','deny');
      insert into access.membershipoverride values
      ('member:one','voucher.binding.read','allow','actor:one','绑定记录授权','2026-09-01',null,null),
      ('member:one','voucher.history.read','deny','actor:two','禁止检索','2026-09-01',null,null);`);
    await database.exec(`begin; ${permissions} commit;`);
    const role = await database.query<{ effect: string }>(`select effect from access.rolepermission where role_id='role:one' and permission_id='voucher.search.read'`);
    const override = await database.query<{ effect: string }>(`select effect from access.membershipoverride where membership_id='member:one' and permission_id='voucher.search.read'`);
    assert.deepEqual(role.rows, [{ effect: 'deny' }]);
    assert.deepEqual(override.rows, [{ effect: 'deny' }]);
    assert.equal((await database.query(`select 1 from access.rolepermission where role_id='role:one' and permission_id='voucher.holder.read' and effect='allow'`)).rows.length, 1);
  } finally { await database.close(); }
});

test('voucher permission hardcut rejects conflicting time windows atomically instead of extending access', async () => {
  const database = await fixture();
  try {
    await database.exec(`insert into access.rolepermission values('role:one','voucher.binding.read','allow');
      insert into access.membershipoverride values
      ('member:one','voucher.binding.read','allow','actor:one','短期授权','2026-09-01','2026-09-06',null),
      ('member:one','voucher.history.read','allow','actor:one','另一期限','2026-09-01','2026-09-30',null);`);
    await assert.rejects(database.exec(`begin; ${permissions} commit;`), /VOUCHER_OVERRIDE_WINDOW_RECONCILIATION_REQUIRED/);
    await database.exec('rollback');
    assert.equal((await database.query(`select 1 from access.rolepermission where permission_id='voucher.search.read'`)).rows.length, 0);
    assert.equal((await database.query(`select 1 from access.membershipoverride`)).rows.length, 2);
  } finally { await database.close(); }
});

async function fixture(): Promise<PGlite> {
  const database = new PGlite();
  await database.exec(`create schema access;
    create table access.permission(id text primary key,code text not null unique);
    create table access.rolepermission(role_id text not null,permission_id text not null,effect text not null,primary key(role_id,permission_id));
    create table access.membershipoverride(membership_id text not null,permission_id text not null,effect text not null,
      granted_by text not null,reason text not null,effective_at timestamptz not null,expires_at timestamptz,revoked_at timestamptz,
      primary key(membership_id,permission_id));`);
  await database.query(`insert into access.permission(id,code) select code,code from unnest($1::text[]) code`, [codes]);
  return database;
}
