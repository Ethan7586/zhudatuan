import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = await readFile(new URL('./OwnerBootstrapDatabase.sql', import.meta.url), 'utf8');
const baseline = await readFile(new URL('../../../../02_platform_pingtai/database/supabase/migrations/20260828170000_zhudatuan_registration_baseline.sql', import.meta.url), 'utf8');

test('owner bootstrap database contract exposes only one guarded definer function', () => {
  assert.match(source, /security definer/);
  assert.match(source, /session_user<>'zhudatuanbootstrap'/);
  assert.match(source, /deployment\.registration_bootstrap_boundary\(p_sentinel\)/);
  assert.match(source, /revoke all on function deployment\.bootstrap_zhudatuan_owner[^;]+ from public/);
  assert.match(source, /grant execute on function deployment\.bootstrap_zhudatuan_owner[^;]+ to zhudatuanbootstrap/);
  assert.doesNotMatch(source, /grant (?:insert|update|delete) on (?:identity|member|access)\./i);
});

test('owner bootstrap binds one operator membership to owner and self without touching public registration', () => {
  assert.match(source, /'membership-platform-owner-ethan-v1'/);
  assert.match(source, /fixed_tenant,'operator','active'/);
  assert.match(source, /\(fixed_membership,fixed_owner_role,'1970-01-01T00:00:00Z'\)/);
  assert.match(source, /\(fixed_membership,'role:self','1970-01-01T00:00:00Z'\)/);
  assert.match(source, /'platform',fixed_platform/);
  assert.match(source, /'tenant',fixed_tenant/);
  assert.match(source, /'self','self:'\|\|fixed_principal/);
  assert.doesNotMatch(source, /role-zhudatuan-storefront-member/);
});

test('owner bootstrap is exact-idempotent, conflict-failing and never stores plaintext', () => {
  assert.match(source, /active_owner_count=0 and collision_count=0/);
  assert.match(source, /elsif active_owner_count=1/);
  assert.match(source, /OWNER_BOOTSTRAP_CONFLICT/);
  assert.match(source, /passwordFingerprint/);
  assert.match(source, /'plaintextSecretStored',false/);
  assert.doesNotMatch(source, /p_password\b/);
});

test('registration baseline installs the reviewed owner bootstrap contract exactly', () => {
  const contract = source.slice(source.indexOf('create or replace function')).trim();
  assert.ok(baseline.includes(contract));
  assert.match(baseline, /ZHUDATUAN_PLATFORM_OWNER_ROLE_STILL_ASSIGNED/);
  assert.match(baseline, /update access\.role set scope_id='tenant-zhudatuan'/);
});
