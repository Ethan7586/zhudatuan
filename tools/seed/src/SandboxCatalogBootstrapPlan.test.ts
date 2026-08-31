import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SANDBOX_CATALOG_CONFIRMATION, SANDBOX_CATALOG_SCHEMA_CHECKSUM, SANDBOX_CATALOG_SCHEMA_VERSION, sandboxCatalogBootstrapEnvironment, sandboxCatalogBootstrapSummary } from './SandboxCatalogBootstrapPlan';

const secret = 'sandbox-bootstrap-password-2026';
const sentinel = 'S'.repeat(43);
const source = Object.freeze({
  APP_ENV: 'test',
  ZHUDATUAN_SANDBOX_CATALOG_CONFIRM: SANDBOX_CATALOG_CONFIRMATION,
  ZHUDATUAN_SANDBOX_CATALOG_DATABASE_URL: `postgresql://zhudatuansandboxbootstrap:${secret}@127.0.0.1:55432/zhudatuan_registration`,
  ZHUDATUAN_SANDBOX_CATALOG_DATABASE_NAME: 'zhudatuan_registration',
  ZHUDATUAN_SANDBOX_CATALOG_SENTINEL: sentinel,
});

test('pins the exact purchase schema marker', () => {
  assert.equal(SANDBOX_CATALOG_SCHEMA_VERSION, '20260828180000');
  assert.match(SANDBOX_CATALOG_SCHEMA_CHECKSUM, /^[a-f0-9]{64}$/);
});

test('accepts only the dedicated loopback sandbox database boundary', () => {
  assert.throws(() => sandboxCatalogBootstrapEnvironment({ ...source, APP_ENV: 'production' }), /TEST_ENV_REQUIRED/);
  assert.throws(() => sandboxCatalogBootstrapEnvironment({ ...source, ZHUDATUAN_SANDBOX_CATALOG_CONFIRM: 'yes' }), /CONFIRMATION_REQUIRED/);
  assert.throws(() => sandboxCatalogBootstrapEnvironment({ ...source, ZHUDATUAN_SANDBOX_CATALOG_DATABASE_NAME: 'postgres' }), /NAME_MISMATCH/);
  assert.throws(() => sandboxCatalogBootstrapEnvironment({ ...source, ZHUDATUAN_SANDBOX_CATALOG_DATABASE_URL: `postgresql://zhudatuansandboxbootstrap:${secret}@localhost:55432/zhudatuan_registration` }), /ENDPOINT_INVALID/);
  assert.throws(() => sandboxCatalogBootstrapEnvironment({ ...source, ZHUDATUAN_SANDBOX_CATALOG_DATABASE_URL: `postgresql://shopmigration:${secret}@127.0.0.1:55432/zhudatuan_registration` }), /ENDPOINT_INVALID/);
  assert.throws(() => sandboxCatalogBootstrapEnvironment({ ...source, ZHUDATUAN_SANDBOX_CATALOG_DATABASE_URL: 'postgresql://zhudatuansandboxbootstrap:short@127.0.0.1:55432/zhudatuan_registration' }), /ENDPOINT_INVALID/);
  assert.throws(() => sandboxCatalogBootstrapEnvironment({ ...source, ZHUDATUAN_SANDBOX_CATALOG_SENTINEL: 'short' }), /SENTINEL_INVALID/);
  assert.equal(sandboxCatalogBootstrapEnvironment(source).expectedDatabase, 'zhudatuan_registration');
});

test('operational summary identifies sandbox artifacts without leaking credentials', () => {
  const summary = sandboxCatalogBootstrapSummary();
  assert.match(summary, /application:zhudatuan:sandbox:v1/);
  assert.match(summary, /listing:zhudatuan:sandbox:welcome/);
  assert.match(summary, /sandbox=true/);
  assert.doesNotMatch(summary, new RegExp(secret));
  assert.doesNotMatch(summary, new RegExp(sentinel));
});
