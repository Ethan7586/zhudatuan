import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  OWNER_BOOTSTRAP_CONFIRMATION,
  OWNER_MEMBERSHIP_ID,
  OWNER_PRINCIPAL_ID,
  ownerBootstrapEnvironment,
  ownerBootstrapSummary,
  ownerPasswordFingerprint,
  ownerSubjectHash,
} from './OwnerBootstrapPlan';

const valid = Object.freeze({
  APP_ENV: 'production',
  ZHUDATUAN_OWNER_BOOTSTRAP_CONFIRM: OWNER_BOOTSTRAP_CONFIRMATION,
  ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL: 'postgresql://zhudatuanbootstrap:a-very-long-database-password@127.0.0.1:55432/zhudatuan_registration',
  ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_NAME: 'zhudatuan_registration',
  ZHUDATUAN_OWNER_BOOTSTRAP_SENTINEL: 'database_boundary_sentinel_abcdefghijklmnopqrstuvwxyz',
  ZHUDATUAN_OWNER_BOOTSTRAP_ACTOR: 'owner:Ethan',
  ZHUDATUAN_OWNER_PASSWORD_REF: 'zhudatuan/registration/owner/password',
  IDENTITY_KEY_REF: 'zhudatuan/registration/identity/index',
  SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
  SECRET_STORE_BEARER_TOKEN: 'secret_store_token_abcdefghijklmnopqrstuvwxyz0123456789',
} satisfies NodeJS.ProcessEnv);

describe('owner bootstrap plan', () => {
  it('accepts only the explicit production, loopback, independent database boundary', () => {
    const environment = ownerBootstrapEnvironment({ ...valid });
    assert.equal(environment.actor, 'owner:Ethan');
    assert.equal(environment.expectedDatabase, 'zhudatuan_registration');
    assert.equal(environment.secretStoreEndpoint, 'https://127.0.0.1:8543');
    assert.throws(() => ownerBootstrapEnvironment({ ...valid, APP_ENV: 'test' }), /PRODUCTION_ENV_REQUIRED/);
    assert.throws(() => ownerBootstrapEnvironment({ ...valid, ZHUDATUAN_OWNER_BOOTSTRAP_CONFIRM: 'yes' }), /CONFIRMATION_REQUIRED/);
    assert.throws(() => ownerBootstrapEnvironment({ ...valid,
      ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL: 'postgresql://zhudatuanbootstrap:a-very-long-database-password@db.internal:5432/zhudatuan_registration' }),
    /DATABASE_ENDPOINT_INVALID/);
    assert.throws(() => ownerBootstrapEnvironment({ ...valid, SECRET_STORE_ENDPOINT: 'https://localhost:8543' }),
      /SECRET_STORE_ENDPOINT_INVALID/);
    assert.throws(() => ownerBootstrapEnvironment({ ...valid, SECRET_STORE_BEARER_TOKEN: 'short' }),
      /SECRET_STORE_TOKEN_INVALID/);
  });

  it('keeps password and identity-key references independent', () => {
    assert.throws(() => ownerBootstrapEnvironment({ ...valid,
      ZHUDATUAN_OWNER_PASSWORD_REF: valid.IDENTITY_KEY_REF }), /SECRET_REFERENCES_MUST_DIFFER/);
  });

  it('uses canonical HMAC subject and a domain-separated password fingerprint', () => {
    const key = 'identity-key-material-at-least-thirty-two-bytes';
    const subject = ownerSubjectHash(key);
    const password = ownerPasswordFingerprint(key, 'Correct-Horse-7!Battery');
    assert.match(subject, /^[a-f0-9]{64}$/);
    assert.match(password, /^[a-f0-9]{64}$/);
    assert.notEqual(subject, password);
    assert.equal(ownerSubjectHash(key), subject);
    assert.equal(ownerPasswordFingerprint(key, 'Correct-Horse-7!Battery'), password);
    assert.notEqual(ownerPasswordFingerprint(key, 'Different-Horse-7!Battery'), password);
  });

  it('never includes a password or hash in its operator summary', () => {
    const summary = ownerBootstrapSummary('created');
    assert.match(summary, new RegExp(OWNER_PRINCIPAL_ID));
    assert.match(summary, new RegExp(OWNER_MEMBERSHIP_ID));
    assert.match(summary, /target=console/);
    assert.doesNotMatch(summary, /password|hash|secret/i);
  });
});
