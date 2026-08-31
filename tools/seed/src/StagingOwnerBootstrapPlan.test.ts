import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ownerBootstrapEnvironment } from './OwnerBootstrapPlan';
import {
  STAGING_OWNER_BOOTSTRAP_CONFIRMATION,
  stagingOwnerBootstrapReceiptFingerprint,
  stagingOwnerBootstrapEnvironment,
  stagingOwnerBootstrapSummary,
} from './StagingOwnerBootstrapPlan';

const databasePassword = 'test-only-staging-owner-database-password';
const valid = Object.freeze({
  APP_ENV: 'staging',
  ZHUDATUAN_OWNER_BOOTSTRAP_CONFIRM: STAGING_OWNER_BOOTSTRAP_CONFIRMATION,
  ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL: `postgresql://zhudatuanbootstrap:${databasePassword}@127.0.0.1:55442/zhudatuan_registration?sslmode=disable`,
  ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_NAME: 'zhudatuan_registration',
  ZHUDATUAN_OWNER_BOOTSTRAP_SENTINEL: 'staging_database_boundary_sentinel_abcdefghijklmnop',
  ZHUDATUAN_OWNER_BOOTSTRAP_ACTOR: 'owner:staging:Ethan',
  ZHUDATUAN_OWNER_PASSWORD_REF: 'zhudatuan/staging/owner/password',
  ZHUDATUAN_OWNER_BOOTSTRAP_RECEIPT_REF: 'zhudatuan/staging/owner/bootstrap-receipt',
  IDENTITY_KEY_REF: 'zhudatuan/staging/identity/index',
  SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8643',
  SECRET_STORE_BEARER_TOKEN: 'staging_secret_store_token_abcdefghijklmnopqrstuvwxyz0123456789',
} satisfies NodeJS.ProcessEnv);

describe('staging owner bootstrap plan', () => {
  it('accepts only the dedicated staging confirmation, loopback port, sentinel and secret namespace', () => {
    const environment = stagingOwnerBootstrapEnvironment({ ...valid });
    assert.equal(environment.expectedDatabase, 'zhudatuan_registration');
    assert.equal(environment.actor, 'owner:staging:Ethan');
    assert.match(environment.connectionString, /@127\.0\.0\.1:55442\/zhudatuan_registration\?sslmode=disable$/);
    assert.throws(() => stagingOwnerBootstrapEnvironment({ ...valid, APP_ENV: 'production' }), /STAGING_ENV_REQUIRED/);
    assert.throws(() => stagingOwnerBootstrapEnvironment({ ...valid,
      ZHUDATUAN_OWNER_BOOTSTRAP_CONFIRM: 'CREATE_ONE_ZHUDATUAN_CONSOLE_OWNER_ETHAN' }), /CONFIRMATION_REQUIRED/);
    assert.throws(() => stagingOwnerBootstrapEnvironment({ ...valid,
      ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL: `postgresql://zhudatuanbootstrap:${databasePassword}@127.0.0.1:55432/zhudatuan_registration?sslmode=disable` }),
    /DATABASE_ENDPOINT_INVALID/);
    assert.throws(() => stagingOwnerBootstrapEnvironment({ ...valid,
      ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL: `postgresql://zhudatuanbootstrap:${databasePassword}@127.0.0.1:55442/zhudatuan_registration` }),
    /DATABASE_ENDPOINT_INVALID/);
    assert.throws(() => stagingOwnerBootstrapEnvironment({ ...valid,
      ZHUDATUAN_OWNER_PASSWORD_REF: 'zhudatuan/registration/owner/password' }), /PASSWORD_REF_INVALID/);
    assert.throws(() => stagingOwnerBootstrapEnvironment({ ...valid,
      ZHUDATUAN_OWNER_BOOTSTRAP_SENTINEL: 'database_boundary_sentinel_abcdefghijklmnopqrstuvwxyz' }), /SENTINEL_INVALID/);
  });

  it('does not relax the existing production plan to accept the staging endpoint', () => {
    assert.throws(() => ownerBootstrapEnvironment({ ...valid, APP_ENV: 'production',
      ZHUDATUAN_OWNER_BOOTSTRAP_CONFIRM: 'CREATE_ONE_ZHUDATUAN_CONSOLE_OWNER_ETHAN' }), /DATABASE_ENDPOINT_INVALID/);
  });

  it('uses a separate, case-sensitive high-entropy bootstrap receipt instead of fingerprinting the password', () => {
    const key = 'identity-key-material-at-least-thirty-two-bytes';
    const lower = stagingOwnerBootstrapReceiptFingerprint(key, 'receipt-material-at-least-thirty-two-bytes-a');
    const upper = stagingOwnerBootstrapReceiptFingerprint(key, 'Receipt-material-at-least-thirty-two-bytes-a');
    assert.match(lower, /^[a-f0-9]{64}$/);
    assert.notEqual(lower, upper);
    assert.throws(() => stagingOwnerBootstrapReceiptFingerprint(key, 'short'), /RECEIPT_INVALID/);
    assert.throws(() => stagingOwnerBootstrapEnvironment({ ...valid,
      ZHUDATUAN_OWNER_BOOTSTRAP_RECEIPT_REF: valid.ZHUDATUAN_OWNER_PASSWORD_REF }), /SECRET_REFERENCES_MUST_DIFFER/);
  });

  it('emits a staging-labelled summary without secret material', () => {
    const summary = stagingOwnerBootstrapSummary('created');
    assert.match(summary, /^ZHUDATUAN_STAGING_OWNER_BOOTSTRAP_READY /);
    assert.doesNotMatch(summary, /password|hash|secret/i);
  });
});
