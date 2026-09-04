import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migration = await readFile(new URL(
  '../../../../02_platform_pingtai/database/supabase/migrations/20260828173000_zhudatuan_web_business_access.sql', import.meta.url,
), 'utf8');
const databaseInit = await readFile(new URL(
  '../../../../02_platform_pingtai/infrastructure/zhudatuan/aliyun/postgres-init-registration.sh', import.meta.url,
), 'utf8');
const databaseEnvironment = await readFile(new URL(
  '../../../../02_platform_pingtai/infrastructure/zhudatuan/aliyun/postgres.env.example', import.meta.url,
), 'utf8');
const webGrants = migration.slice(
  migration.indexOf('grant usage on schema public,identity,access'),
  migration.indexOf('-- Runtime control and authorization.'),
);

test('web business schema marker is the normalized migration digest', () => {
  const marker = /values\('20260828173000','([a-f0-9]{64})'\)/.exec(migration)?.[1];
  assert.ok(marker);
  const normalized = migration.replaceAll(marker, '0'.repeat(64));
  assert.equal(createHash('sha256').update(normalized).digest('hex'), marker);
});

test('web business role is isolated and exposes the owner and benefit helpers only to its login', () => {
  assert.match(migration, /create role %I nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls/);
  assert.match(migration, /create or replace function access\.web_member_scope\(p_membership text,p_session text\)\s+returns jsonb[\s\S]+security definer/);
  assert.match(migration, /session_user<>'zhudatuanwebapi'/);
  assert.match(migration, /session\.id=p_session and session\.membership_id=p_membership/);
  assert.match(migration, /session\.revoked_at is null and session\.expires_at>clock_timestamp\(\)/);
  assert.match(migration, /session\.credential_version=principal\.credential_version/);
  assert.match(migration, /session\.access_version=membership\.access_version/);
  assert.match(migration, /access\.scope_object\(membership\.member_id\)/);
  assert.match(migration, /create or replace function access\.web_storefront_scope\(p_membership text,p_session text\)\s+returns jsonb[\s\S]+security definer/);
  assert.match(migration, /membership\.client='storefront' and session\.client=membership\.client/);
  assert.match(migration, /organization\.kind='mall' and organization\.status='active'/);
  assert.match(migration, /access\.scope_object\(membership\.organization_id\)/);
  assert.match(migration, /create or replace function benefit\.web_account_balance\(p_membership text,p_session text\)\s+returns table\(account_id text,available_minor bigint,reserved_minor bigint\)/);
  assert.match(migration, /session\.id=p_session and session\.membership_id=p_membership/);
  assert.match(migration, /account\.member_id=owned_member and account\.scope_id=owned_scope/);
  assert.match(migration, /create or replace function access\.web_risk_scope_allowed\(p_scope text\)/);
  assert.match(migration, /membership\.client='storefront' and \([\s\S]+p_scope=membership\.member_id or exists/);
  assert.match(migration, /closure\.descendant_id=membership\.organization_id and closure\.ancestor_id=p_scope/);
  assert.match(migration, /risk\.policy for select to zhudatuanwebapi using\(access\.web_risk_scope_allowed\(scope_id\)\)/);
  assert.match(migration, /risk\.listentry for select to zhudatuanwebapi[\s\S]+access\.web_risk_scope_allowed\(scope_id\)/);
  assert.match(migration, /access\.decisionaudit for select to zhudatuanwebapi[\s\S]+access\.web_risk_scope_allowed\(scope_id\)/);
  assert.doesNotMatch(migration, /risk\.decision for select to zhudatuanwebapi/);
  assert.match(migration, /grant execute on function[\s\S]+access\.web_member_scope\(text,text\)[\s\S]+access\.web_storefront_scope\(text,text\)[\s\S]+benefit\.web_account_balance\(text,text\)[\s\S]+to zhudatuanwebapi/);
});

test('selected SQL has exact table grants including supplier catalog without checkout or ledger access', () => {
  assert.match(webGrants, /grant select on catalog\.product,catalog\.sku,catalog\.listing,catalog\.sourcelisting to zhudatuanwebapi/);
  assert.match(webGrants, /grant select,insert,update on checkout\.address to zhudatuanwebapi/);
  assert.match(webGrants, /grant select,insert,update on cart\.cart to zhudatuanwebapi/);
  assert.match(webGrants, /grant select,insert,update,delete on cart\.item to zhudatuanwebapi/);
  assert.match(webGrants, /grant select,insert on access\.decisionaudit to zhudatuanwebapi/);
  assert.doesNotMatch(webGrants, /(?:checkout\.session|payment\.|finance\.|runtime\.(?:outbox|job))/);
  assert.doesNotMatch(webGrants, /benefit\.reservation|runtime\.projectionoffset/);
  assert.doesNotMatch(webGrants, /grant (?:insert|update|delete|[^;]*,(?:insert|update|delete))[^;]+(?:risk\.|ordering\.|benefit\.)/i);
  assert.doesNotMatch(webGrants, /schema[^;]*finance/);
});

test('migration contains fail-closed assertions for privileged and prohibited domains', () => {
  assert.match(migration, /ZHUDATUAN_WEB_ROLE_INHERITS_BROAD_RUNTIME/);
  assert.match(migration, /membership\.member in\(select oid from pg_roles[\s\S]+membership\.roleid in\(select oid from pg_roles/);
  assert.match(migration, /ZHUDATUAN_WEB_FORBIDDEN_WRITE/);
  assert.match(migration, /finance\.account/);
  assert.match(migration, /payment\.intent/);
  assert.match(migration, /runtime\.outbox/);
  assert.match(migration, /has_function_privilege\('zhudatuanwebapi','access\.web_member_scope\(text,text\)','EXECUTE'\)/);
  assert.match(migration, /has_function_privilege\('zhudatuanwebapi','access\.web_storefront_scope\(text,text\)','EXECUTE'\)/);
  assert.match(migration, /has_function_privilege\('zhudatuanwebapi','access\.web_risk_scope_allowed\(text\)','EXECUTE'\)/);
  assert.match(migration, /version in\('20260821032000','20260821054000','20260828170000','20260828173000'\)/);
  assert.match(migration, /deployment\.sandbox_catalog_bootstrap_boundary\(p_sentinel text\)[\s\S]+session_user<>'zhudatuansandboxbootstrap'/);
  assert.match(migration, /grant execute on function deployment\.sandbox_catalog_bootstrap_boundary\(text\),public\.digest\(text,text\) to zhudatuansandboxbootstrap/);
  assert.doesNotMatch(migration, /grant execute on function deployment\.registration_bootstrap_boundary\(text\)[^;]+zhudatuansandboxbootstrap/);
  assert.doesNotMatch(migration, /insert into (?:catalog|pricing|inventory|experience)\./i);
});

test('database init preprovisions both login roles without putting credentials in argv or migration', () => {
  assert.match(databaseInit, /\\getenv web_api_password ZHUDATUAN_WEB_API_PASSWORD/);
  assert.match(databaseInit, /\\getenv sandbox_bootstrap_password ZHUDATUAN_SANDBOX_BOOTSTRAP_PASSWORD/);
  assert.match(databaseInit, /create role zhudatuanwebapi login password %L noinherit',:'web_api_password'/);
  assert.match(databaseInit, /create role zhudatuansandboxbootstrap login password %L noinherit',:'sandbox_bootstrap_password'/);
  assert.match(databaseInit, /ZHUDATUAN_RDS_INIT_ROLE_ATTRIBUTE_INVALID/);
  assert.doesNotMatch(databaseInit, /--set|--variable|-v[= ]/);
  assert.match(databaseInit,
    /revoke all on deployment\.boundary[\s\S]+zhudatuanwebapi,\s*zhudatuanpurchaseapi,zhudatuanprovisioningapi,zhudatuansandboxbootstrap/);
  assert.match(databaseInit, /grant execute on function deployment\.is_independent_registration_database\(\) to shopmigration/);
  assert.doesNotMatch(databaseInit, /grant (?:select|insert|update|delete)[^;]*deployment\.boundary to (?:zhudatuanwebapi|zhudatuansandboxbootstrap)/i);
  assert.match(databaseEnvironment, /^ZHUDATUAN_WEB_API_PASSWORD=/m);
  assert.match(databaseEnvironment, /^ZHUDATUAN_SANDBOX_BOOTSTRAP_PASSWORD=/m);
  assert.doesNotMatch(migration, /password\s+%L|ZHUDATUAN_(?:WEB_API|SANDBOX_BOOTSTRAP)_PASSWORD/);
});
