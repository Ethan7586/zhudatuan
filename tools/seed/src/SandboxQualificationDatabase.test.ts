import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migration = await readFile(new URL(
  '../../../database/supabase/migrations/20260828180000_zhudatuan_purchase_access.sql', import.meta.url,
), 'utf8');
const runner = await readFile(new URL('./BootstrapSandboxQualification.ts', import.meta.url), 'utf8');
const qualificationBoundary = migration.slice(
  migration.indexOf('create or replace function deployment.sandbox_member_qualification_bootstrap'),
  migration.indexOf('create or replace function deployment.sandbox_member_welfare_bootstrap'),
);

test('qualification boundary is direct-login, one-member, idempotent and audit chained', () => {
  assert.match(qualificationBoundary, /sandbox_member_qualification_bootstrap\(p_sentinel text,p_membership text\)/);
  assert.match(qualificationBoundary, /session_user<>'zhudatuansandboxbootstrap'/);
  assert.match(qualificationBoundary, /membership\.id=p_membership and membership\.client='storefront' and membership\.status='active'/);
  assert.match(qualificationBoundary, /role_id='role-zhudatuan-storefront-member'/);
  assert.match(qualificationBoundary, /insert into qualification\.profile/);
  assert.match(qualificationBoundary, /on conflict\(member_id\) do nothing/);
  assert.match(qualificationBoundary, /pg_advisory_xact_lock\(hashtextextended\('audit:mall-zhudatuan',0\)\)/);
  assert.match(qualificationBoundary, /qualification\.sandbox\.activated/);
  assert.match(qualificationBoundary, /'benefitAccountCreated',false,'benefitAmountGranted',false/);
  assert.match(qualificationBoundary, /record\.record_hash=encode\(public\.digest\(record\.id/);
  assert.doesNotMatch(qualificationBoundary, /insert into benefit\.(?:account|lot|grantbatch|grantitem)/);
});

test('qualification runner requires the dedicated boundary and never mutates benefit data', () => {
  assert.match(runner, /begin isolation level serializable/);
  assert.match(runner, /sandbox_member_qualification_bootstrap\(\$1,\$2\)/);
  assert.match(runner, /database_role !== 'zhudatuansandboxbootstrap'/);
  assert.match(runner, /deployment\.sandbox_catalog_bootstrap_boundary\(\$2\)/);
  assert.doesNotMatch(runner, /insert into|update\s+benefit|delete from/i);
});
