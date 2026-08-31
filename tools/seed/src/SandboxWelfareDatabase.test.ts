import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migration = await readFile(new URL('../../../database/migrations/20260828180000_zhudatuan_purchase_access.sql', import.meta.url), 'utf8');
const runner = await readFile(new URL('./BootstrapSandboxWelfare.ts', import.meta.url), 'utf8');
const boundary = migration.slice(migration.indexOf('create or replace function deployment.sandbox_member_welfare_bootstrap'), migration.indexOf('revoke all on function access.purchase_session_context'));

test('welfare one-shot is explicit, exact-idempotent and audit chained', () => {
  assert.match(boundary, /sandbox_member_welfare_bootstrap\([\s\S]+p_amount bigint,p_currency text,p_confirmation text/);
  assert.match(boundary, /session_user<>'zhudatuansandboxbootstrap'/);
  assert.match(boundary, /OWNER_APPROVES_ONE_EXPLICIT_SANDBOX_WELFARE_GRANT/);
  assert.match(boundary, /p_amount<1 or p_amount>1000000 or p_currency is distinct from 'CNY'/);
  assert.match(boundary, /qualification\.attributes->>'bootstrap'='zhudatuan-sandbox-member-qualification-v1'/);
  assert.match(boundary, /SANDBOX_WELFARE_AMOUNT_CONFLICT/);
  assert.match(boundary, /perform finance\.post\('mall-zhudatuan','benefit\.sandbox\.grant'/);
  assert.match(boundary, /'automaticRegistrationGrant',false/);
  assert.match(boundary, /pg_advisory_xact_lock\(hashtextextended\('audit:mall-zhudatuan',0\)\)/);
  assert.match(boundary, /record\.record_hash=encode\(public\.digest\(record\.id/);
  assert.doesNotMatch(boundary, /\bdelete\s+from\b|\btruncate\b/i);
});

test('welfare CLI is test-only, direct-role and checks it has no finance or benefit schema usage', () => {
  assert.match(runner, /sandboxWelfareBootstrapEnvironment\(process\.env\)/);
  assert.match(runner, /begin isolation level serializable/);
  assert.match(runner, /sandbox_member_welfare_bootstrap\(\$1,\$2,\$3,\$4,\$5\)/);
  assert.match(runner, /database_role !== 'zhudatuansandboxbootstrap'/);
  assert.match(runner, /row\.benefit_usage !== false \|\|\s*row\.finance_usage !== false/);
  assert.doesNotMatch(runner, /\/api\/|listen\(|createServer\(/);
});
