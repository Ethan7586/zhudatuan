import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SANDBOX_QUALIFICATION_CONFIRMATION,
  SANDBOX_QUALIFICATION_SCHEMA_CHECKSUM,
  SANDBOX_QUALIFICATION_SCHEMA_VERSION,
  sandboxQualificationBootstrapEnvironment,
  sandboxQualificationBootstrapSummary,
} from './SandboxQualificationBootstrapPlan';

const password = 'sandbox-bootstrap-password-2026';
const sentinel = 'Q'.repeat(43);
const membership = 'membership:sandbox:registered-member';
const source = Object.freeze({
  APP_ENV: 'test',
  ZHUDATUAN_SANDBOX_QUALIFICATION_CONFIRM: SANDBOX_QUALIFICATION_CONFIRMATION,
  ZHUDATUAN_SANDBOX_QUALIFICATION_DATABASE_URL:
    `postgresql://zhudatuansandboxbootstrap:${password}@127.0.0.1:55432/zhudatuan_registration`,
  ZHUDATUAN_SANDBOX_QUALIFICATION_DATABASE_NAME: 'zhudatuan_registration',
  ZHUDATUAN_SANDBOX_QUALIFICATION_SENTINEL: sentinel,
  ZHUDATUAN_SANDBOX_QUALIFICATION_MEMBERSHIP: membership,
});

test('qualification bootstrap is pinned to the purchase schema marker', () => {
  assert.equal(SANDBOX_QUALIFICATION_SCHEMA_VERSION, '20260828180000');
  assert.match(SANDBOX_QUALIFICATION_SCHEMA_CHECKSUM, /^[a-f0-9]{64}$/);
});

test('qualification bootstrap accepts only one explicit registered sandbox membership', () => {
  assert.throws(() => sandboxQualificationBootstrapEnvironment({ ...source, APP_ENV: 'production' }), /TEST_ENV_REQUIRED/);
  assert.throws(() => sandboxQualificationBootstrapEnvironment({ ...source,
    ZHUDATUAN_SANDBOX_QUALIFICATION_CONFIRM: 'yes' }), /CONFIRMATION_REQUIRED/);
  assert.throws(() => sandboxQualificationBootstrapEnvironment({ ...source,
    ZHUDATUAN_SANDBOX_QUALIFICATION_DATABASE_URL:
      `postgresql://shopmigration:${password}@127.0.0.1:55432/zhudatuan_registration` }), /ENDPOINT_INVALID/);
  assert.throws(() => sandboxQualificationBootstrapEnvironment({ ...source,
    ZHUDATUAN_SANDBOX_QUALIFICATION_MEMBERSHIP: '../../all-members' }), /MEMBERSHIP_INVALID/);
  assert.equal(sandboxQualificationBootstrapEnvironment(source).membership, membership);
});

test('qualification summary is explicit and promises no default benefit amount', () => {
  const summary = sandboxQualificationBootstrapSummary(membership);
  assert.match(summary, new RegExp(membership));
  assert.match(summary, /benefitMinor=0/);
  assert.match(summary, /sandbox=true/);
  assert.doesNotMatch(summary, new RegExp(password));
  assert.doesNotMatch(summary, new RegExp(sentinel));
});
