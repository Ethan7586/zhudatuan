import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migration170 = await migration('20260828170000_zhudatuan_registration_baseline.sql');
const migration173 = await migration('20260828173000_zhudatuan_web_business_access.sql');
const migration180 = await migration('20260828180000_zhudatuan_purchase_access.sql');
const databaseInit = await readFile(new URL(
  '../../../infrastructure/zhudatuan/aliyun/postgres-init-registration.sh', import.meta.url,
), 'utf8');
const databaseEnvironment = await readFile(new URL(
  '../../../infrastructure/zhudatuan/aliyun/postgres.env.example', import.meta.url,
), 'utf8');

test('all zhudatuan append-only markers are their normalized migration digests', () => {
  for (const [version, source] of [
    ['20260828170000', migration170],
    ['20260828173000', migration173],
    ['20260828180000', migration180],
  ] as const) {
    const marker = new RegExp(`values\\('${version}','([a-f0-9]{64})'\\)`).exec(source)?.[1];
    assert.ok(marker, version);
    assert.equal(createHash('sha256').update(source.replaceAll(marker, '0'.repeat(64))).digest('hex'), marker, version);
  }
});

test('purchase role has direct-session benefit boundaries without finance or voucher access', () => {
  assert.match(migration180, /create role zhudatuanpurchaseapi nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls/);
  assert.match(migration180, /purchase_session_context\([\s\S]+session_user<>'zhudatuanpurchaseapi'/);
  assert.match(migration180, /identity\.assurance evidence[\s\S]+method='phone_otp'[\s\S]+expires_at>clock_timestamp\(\)/);
  assert.match(migration180, /benefit\.purchase_available\(p_membership text,p_session text,p_accounts text\[\]\)/);
  assert.match(migration180, /owned_count<>cardinality\(p_accounts\)[\s\S]+PURCHASE_BENEFIT_ACCOUNT_NOT_USABLE/);
  assert.match(migration180, /benefit\.purchase_reserve\([\s\S]+p_membership text,p_session text,p_order text,p_member text,p_accounts text\[\],p_amounts bigint\[\]/);
  assert.match(migration180, /benefit\.purchase_consume\([\s\S]+p_membership text,p_session text,p_order text,p_intent text,p_account text,p_amount bigint/);
  assert.match(migration180, /not exists\(select 1 from payment\.intenttender tender where tender\.intent_id=intent\.id and tender\.kind<>'benefit'\)/);
  assert.match(migration180, /perform finance\.post\(context\.mall_id,'benefit\.consume'/);
  assert.match(migration180, /has_schema_privilege\('zhudatuanpurchaseapi','finance','USAGE'\)/);
  assert.match(migration180, /has_schema_privilege\('zhudatuanpurchaseapi','voucher','USAGE'\)/);
  assert.match(migration180, /ZHUDATUAN_PURCHASE_FINANCE_BOUNDARY_BYPASS/);
  assert.doesNotMatch(migration180, /grant execute on function finance\.[^;]+zhudatuanpurchaseapi/);
  assert.doesNotMatch(migration180, /grant (?:select|insert|update|delete)[^;]+benefit\.(?:account|lot|lotmovement|reservation|balance)[^;]+zhudatuanpurchaseapi/);
});

test('payment RLS admits only internal benefit capture and excludes provider/refund surfaces', () => {
  assert.match(migration180, /payment\.intenttender for insert to zhudatuanpurchaseapi[\s\S]+kind='benefit' and state='held'/);
  assert.match(migration180, /payment\.capture for insert to zhudatuanpurchaseapi[\s\S]+source='internal'/);
  assert.match(migration180, /ordering\.line for insert to zhudatuanpurchaseapi[\s\S]+provider is null and partner_id is null/);
  assert.match(migration180, /fulfillment\.fulfillmentorder for insert to zhudatuanpurchaseapi[\s\S]+provider is null and partner_id is null and store_id is null/);
  assert.match(migration180, /inventory\.reservation for select to zhudatuanpurchaseapi[\s\S]+access\.purchase_order_allowed\(owner_id\)/);
  for (const relation of ['payment.attempt', 'payment.prepay', 'payment.observation', 'payment.providerattempt',
    'payment.refund', 'payment.refundcommand', 'payment.refundtender']) {
    assert.ok(migration180.includes(`'${relation}'`), relation);
  }
  assert.doesNotMatch(migration180, /grant (?:select|insert|update|delete)[^;]+payment\.(?:attempt|prepay|observation|providerattempt|refund|refundcommand|refundtender)/);
  assert.match(migration180, /for table_name in select schemaname\|\|'\.'\|\|tablename[\s\S]+has_table_privilege\('zhudatuanpurchaseapi',table_name,'DELETE'\)/);
});

test('purchase UPDATE privileges are exact canonical transition columns', () => {
  const expected = new Map<string, readonly string[]>([
    ['runtime.idempotency', ['state', 'response']],
    ['cart.cart', ['state', 'updated_at', 'version']],
    ['checkout.session', ['state', 'version']],
    ['inventory.stockitem', ['onhand', 'version', 'updated_at']],
    ['inventory.reservation', ['state', 'version']],
    ['marketing.campaign', ['spent_minor', 'version', 'updated_at']],
    ['marketing.redemption', ['state', 'updated_at']],
    ['ordering.orderrecord', ['payment_state', 'fulfillment_state', 'lifecycle_state', 'updated_at', 'version']],
    ['payment.intent', ['state', 'version']],
    ['payment.intenttender', ['state']],
  ]);
  const actual = new Map<string, readonly string[]>();
  for (const match of migration180.matchAll(
    /grant update\(([^)]+)\) on ([a-z]+\.[a-z]+) to zhudatuanpurchaseapi;/g,
  )) {
    actual.set(match[2]!, match[1]!.split(',').map((column) => column.trim()));
  }
  assert.deepEqual(actual, expected);
  assert.doesNotMatch(migration180, /grant (?:[^;]*,)?update on [^;]+ to zhudatuanpurchaseapi;/);
  assert.doesNotMatch(migration180, /grant update\([^)]*\) on pricing\.quote to zhudatuanpurchaseapi/);
  assert.match(migration180, /\('pricing','quote',array\[\]::text\[\]\)/);
  assert.match(migration180, /has_table_privilege\('zhudatuanpurchaseapi',table_name,'UPDATE'\)/);
  assert.match(migration180, /not column_definition\.attname=any\(update_contract\.allowed_columns\)/);
  assert.match(migration180, /has_column_privilege\('zhudatuanpurchaseapi',relation\.oid,column_definition\.attnum,'UPDATE'\)/);
  for (const immutable of ['member_id', 'mall_id', 'scope_id', 'order_id', 'amount_minor', 'currency',
    'reference_id', 'evidence', 'checkout_id']) {
    assert.ok(![...expected.values()].some((columns) => columns.includes(immutable)), immutable);
  }
});

test('web ledger remains session-bound and does not widen the 4322 finance boundary', () => {
  assert.match(migration180, /benefit\.web_ledger\(p_membership text,p_session text\)/);
  assert.match(migration180, /session_user<>'zhudatuanwebapi'/);
  assert.match(migration180, /account\.member_id=owned_member and account\.scope_id=owned_scope/);
  assert.match(migration180, /grant execute on function benefit\.web_ledger\(text,text\) to zhudatuanwebapi/);
  assert.match(migration180, /has_schema_privilege\('zhudatuanwebapi','finance','USAGE'\)/);
});

test('purchase role is preprovisioned as an isolated login and cannot join either side of a role grant', () => {
  assert.match(databaseInit, /create_role zhudatuanpurchaseapi "\$ZHUDATUAN_PURCHASE_API_PASSWORD"/);
  assert.match(databaseEnvironment, /^ZHUDATUAN_PURCHASE_API_PASSWORD=/m);
  assert.match(databaseInit, /revoke all on deployment\.boundary[\s\S]+zhudatuanpurchaseapi/);
  assert.match(migration180, /membership\.member=\(select oid from pg_roles where rolname='zhudatuanpurchaseapi'\)[\s\S]+membership\.roleid=\(select oid from pg_roles where rolname='zhudatuanpurchaseapi'\)/);
  assert.doesNotMatch(migration180, /password\s|ZHUDATUAN_PURCHASE_API_PASSWORD/);
});

async function migration(file: string): Promise<string> {
  return readFile(new URL(`../../../database/supabase/migrations/${file}`, import.meta.url), 'utf8');
}
