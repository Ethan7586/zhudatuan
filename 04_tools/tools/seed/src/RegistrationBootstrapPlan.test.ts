import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  REGISTRATION_BOOTSTRAP_CONFIRMATION,
  assertExistingInvitation,
  assertRegistrationInvitationExportUsable,
  bootstrapSummary,
  createRegistrationInvitationExport,
  parseRegistrationInvitationExport,
  registrationBootstrapEnvironment,
  registrationInvitationTokenHash,
  sha256,
} from './RegistrationBootstrapPlan';

const databaseUrl = 'postgresql://zhudatuanbootstrap:secret@127.0.0.1:55432/zhudatuan_registration';
const identityKey = 'registration-test-identity-key-value-000000000000000000';
const source = Object.freeze({
  APP_ENV: 'test',
  ZHUDATUAN_REGISTRATION_BOOTSTRAP_CONFIRM: REGISTRATION_BOOTSTRAP_CONFIRMATION,
  ZHUDATUAN_REGISTRATION_BOOTSTRAP_DATABASE_URL: databaseUrl,
  ZHUDATUAN_REGISTRATION_BOOTSTRAP_DATABASE_NAME: 'zhudatuan_registration',
  ZHUDATUAN_REGISTRATION_BOOTSTRAP_OUTPUT: '/private/tmp/zhudatuan-registration-invite.json',
  ZHUDATUAN_REGISTRATION_BOOTSTRAP_SENTINEL: 'A'.repeat(43),
  IDENTITY_KEY_REF: 'zhudatuan/registration/identity/index',
  SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
  SECRET_STORE_BEARER_TOKEN: 's'.repeat(43),
});

test('requires an explicit independent test database boundary', () => {
  assert.throws(() => registrationBootstrapEnvironment({ ...source, APP_ENV: 'production' }), /TEST_ENV_REQUIRED/);
  assert.throws(() => registrationBootstrapEnvironment({ ...source, ZHUDATUAN_REGISTRATION_BOOTSTRAP_CONFIRM: 'yes' }), /CONFIRMATION_REQUIRED/);
  assert.throws(() => registrationBootstrapEnvironment({ ...source, ZHUDATUAN_REGISTRATION_BOOTSTRAP_DATABASE_NAME: 'production' }), /NAME_MISMATCH/);
  assert.throws(() => registrationBootstrapEnvironment({ ...source, ZHUDATUAN_REGISTRATION_BOOTSTRAP_OUTPUT: 'invite.json' }), /OUTPUT_INVALID/);
  const environment = registrationBootstrapEnvironment(source);
  assert.throws(() => registrationBootstrapEnvironment({ ...source,
    ZHUDATUAN_REGISTRATION_BOOTSTRAP_DATABASE_URL: 'postgresql://zhudatuanbootstrap:secret@localhost:55432/zhudatuan_registration' }), /ENDPOINT_INVALID/);
  assert.throws(() => registrationBootstrapEnvironment({ ...source,
    ZHUDATUAN_REGISTRATION_BOOTSTRAP_SENTINEL: 'short' }), /SENTINEL_INVALID/);
  assert.throws(() => registrationBootstrapEnvironment({ ...source,
    SECRET_STORE_BEARER_TOKEN: 'short' }), /SECRET_STORE_BEARER_TOKEN_INVALID/);
  assert.equal(environment.expectedDatabase, 'zhudatuan_registration');
  assert.equal(environment.expiresInHours, 24);
});

test('exports one high-entropy invitation and detects any secret-document drift', () => {
  const exported = createRegistrationInvitationExport(new Date('2026-08-28T09:00:00.000Z'), 24, identityKey);
  assert.equal(exported.invitationCode.length, 43);
  assert.equal(exported.tokenHash, registrationInvitationTokenHash(exported.invitationCode, identityKey));
  assert.notEqual(exported.tokenHash, sha256(exported.invitationCode));
  assert.equal(parseRegistrationInvitationExport(JSON.stringify(exported), identityKey).tokenHash, exported.tokenHash);
  const replacement = exported.invitationCode.endsWith('A') ? 'B' : 'A';
  assert.throws(() => parseRegistrationInvitationExport(JSON.stringify({ ...exported, invitationCode: `${exported.invitationCode.slice(0, -1)}${replacement}` }), identityKey), /EXPORT_INVALID/);
  assert.throws(() => parseRegistrationInvitationExport(JSON.stringify({ ...exported, unexpected: true }), identityKey), /FIELDS_INVALID/);
  assert.throws(() => parseRegistrationInvitationExport(JSON.stringify(exported), `${identityKey}-wrong`), /EXPORT_INVALID/);
});

test('accepts only the exact unused one-time database invitation', () => {
  const exported = createRegistrationInvitationExport(new Date(Date.now() + 60_000), 24, identityKey);
  const existing = {
    id: exported.invitationId,
    organization_id: exported.organizationId,
    label: '主打团测试注册（一次）',
    destination_hash: sha256(exported.invitationId),
    token_hash: exported.tokenHash,
    expires_at: exported.expiresAt,
    created_by: 'owner:Ethan',
    role_id: 'role-zhudatuan-storefront-member',
    allowed_destination_hash: null,
    max_uses: 1,
    use_count: 0,
    effective_at: exported.createdAt,
    status: 'active',
    created_at: exported.createdAt,
    registration_policy_id: exported.policyId,
    terms_hash: exported.termsHash,
  } as const;
  assert.doesNotThrow(() => assertExistingInvitation(existing, exported, 'owner:Ethan'));
  assert.throws(() => assertExistingInvitation({ ...existing, use_count: 1 }, exported, 'owner:Ethan'), /INVITATION_CONFLICT/);
  assert.throws(() => assertExistingInvitation({ ...existing, token_hash: 'a'.repeat(64) }, exported, 'owner:Ethan'), /INVITATION_CONFLICT/);
  assert.doesNotThrow(() => assertRegistrationInvitationExportUsable(exported, new Date(exported.createdAt)));
  assert.throws(() => assertRegistrationInvitationExportUsable(exported, new Date(exported.expiresAt)), /EXPORT_EXPIRED/);
});

test('never includes the invitation secret in the operational summary', () => {
  const exported = createRegistrationInvitationExport(new Date('2026-08-28T09:00:00.000Z'), 24, identityKey);
  const summary = bootstrapSummary(exported, '/private/tmp/invite.json', 'created');
  assert.doesNotMatch(summary, new RegExp(exported.invitationCode));
  assert.match(summary, new RegExp(exported.tokenHash.slice(0, 16)));
});
