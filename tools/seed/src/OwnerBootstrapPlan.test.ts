import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

import {
  OWNER_BOOTSTRAP_CONFIRMATION,
  OWNER_MEMBERSHIP_ID,
  OWNER_PRINCIPAL_ID,
  ownerBootstrapDatabaseEnvironment,
  ownerBootstrapEnvironment,
  ownerBootstrapSummary,
  ownerPasswordFingerprint,
  ownerSubjectHash,
} from './OwnerBootstrapPlan';

const databasePassword = 'test-only-owner-bootstrap-database-password';
const bootstrapSource = await readFile(new URL('./BootstrapOwner.ts', import.meta.url), 'utf8');
const ownerTransferMigration = await readFile(
  new URL('../../../database/supabase/migrations/20260829211000_platform_owner_transfer.sql', import.meta.url), 'utf8');
const valid = Object.freeze({
  APP_ENV: 'production',
  ZHUDATUAN_OWNER_BOOTSTRAP_CONFIRM: OWNER_BOOTSTRAP_CONFIRMATION,
  ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL: `postgresql://zhudatuanbootstrap:${databasePassword}@127.0.0.1:55432/zhudatuan_registration`,
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
      ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL: `postgresql://zhudatuanbootstrap:${databasePassword}@db.internal:5432/zhudatuan_registration` }),
    /DATABASE_ENDPOINT_INVALID/);
    assert.throws(() => ownerBootstrapEnvironment({ ...valid, SECRET_STORE_ENDPOINT: 'https://localhost:8543' }),
      /SECRET_STORE_ENDPOINT_INVALID/);
    assert.throws(() => ownerBootstrapEnvironment({ ...valid, SECRET_STORE_BEARER_TOKEN: 'short' }),
      /SECRET_STORE_TOKEN_INVALID/);
  });

  it('can validate an already-active dynamic Owner before loading retired Ethan secrets', () => {
    const environment = ownerBootstrapDatabaseEnvironment({
      APP_ENV: valid.APP_ENV,
      ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL: valid.ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL,
      ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_NAME: valid.ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_NAME,
      ZHUDATUAN_OWNER_BOOTSTRAP_SENTINEL: valid.ZHUDATUAN_OWNER_BOOTSTRAP_SENTINEL,
    });
    assert.equal(environment.expectedDatabase, 'zhudatuan_registration');
    assert.equal(environment.actor, 'owner:Ethan');
    assert.ok(!Object.hasOwn(environment, 'passwordRef'));
    assert.ok(!Object.hasOwn(environment, 'secretStoreBearerToken'));
    assert.ok(bootstrapSource.indexOf('await database.connect()')
      < bootstrapSource.indexOf('const secrets = ownerBootstrapSecrets(process.env)'));
    assert.ok(bootstrapSource.indexOf("zhudatuan:platform-owner-transfer:v1")
      < bootstrapSource.indexOf('await assertDatabaseBoundary(database'));
    assert.ok(bootstrapSource.indexOf('await assertDatabaseBoundary(database')
      < bootstrapSource.indexOf('const secrets = ownerBootstrapSecrets(process.env)'));
    assert.match(bootstrapSource, /deployment\.zhudatuan_owner_bootstrap_state\(\$1\)/);
    assert.doesNotMatch(bootstrapSource,
      /(?:from|join)\s+(?:access|member|identity)\.(?:membership|profile|principal)\b/i);
    assert.doesNotMatch(bootstrapSource, /activeOwnerIdentity/);
  });

  it('re-reads the dynamic singleton after bootstrap before reporting the identity', () => {
    const bootstrapCall = bootstrapSource.indexOf('deployment.bootstrap_zhudatuan_owner');
    const boundaryCalls = [...bootstrapSource.matchAll(/await assertDatabaseBoundary\(database/g)].map(({ index }) => index ?? -1);
    assert.equal(boundaryCalls.length, 2);
    assert.ok(boundaryCalls[0]! < bootstrapCall);
    assert.ok(boundaryCalls[1]! > bootstrapCall);
    assert.match(bootstrapSource, /identity = activeBoundary\.identity/);
  });

  it('rehydrates only the exact legacy tombstone without deleting its historical primary key', () => {
    assert.match(ownerTransferMigration, /identity\.owner\.legacy_rehydrated/);
    assert.match(ownerTransferMigration, /'legacyPrimaryKeysPreserved',true/);
    assert.match(ownerTransferMigration, /recoverable_legacy_tombstone/);
    assert.match(ownerTransferMigration,
      /update access\.membership set organization_id='tenant-zhudatuan',client='operator',status='active'/);
    assert.doesNotMatch(ownerTransferMigration,
      /delete from access\.membership where id='membership-platform-owner-ethan-v1'/);
    assert.doesNotMatch(ownerTransferMigration,
      /delete from (?:access\.membershiprole|access\.scopegrant|access\.membershipoverride)\s+where membership_id='membership-platform-owner-ethan-v1'/);
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
    const summary = ownerBootstrapSummary('existing', {
      principal: 'principal:transferred-owner', membership: 'membership:transferred-owner',
    });
    assert.match(summary, /principal:transferred-owner/);
    assert.match(summary, /membership:transferred-owner/);
    assert.doesNotMatch(summary, new RegExp(OWNER_PRINCIPAL_ID));
    assert.doesNotMatch(summary, new RegExp(OWNER_MEMBERSHIP_ID));
    assert.match(summary, /target=console/);
    assert.doesNotMatch(summary, /password|hash|secret/i);
  });
});
