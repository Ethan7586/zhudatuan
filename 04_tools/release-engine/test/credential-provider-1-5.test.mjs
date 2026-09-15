import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { assertRoleCapability, credentialSummary, resolveAliyunCredentials } from '../src/credential-provider.mjs';
import { deliveryErrorContract } from '../src/errors.mjs';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const source = (path) => readFile(join(root, path), 'utf8');
const trust = { repository: 'Ethan7586/zhudatuan', ref: 'refs/heads/zdt-next', workflow: 'prepare-artifact-aliyun.yml',
  audience: 'fixture-aliyun', providerArn: 'acs:ram::123:oidc-provider/fixture', roleArn: 'acs:ram::123:role/fixture', eventNames: ['push'] };
const claims = { repository: trust.repository, ref: trust.ref, sub: `repo:${trust.repository}:ref:${trust.ref}`,
  job_workflow_ref: `${trust.repository}/.github/workflows/${trust.workflow}@${trust.ref}`, aud: trust.audience, event_name: 'push' };
const jwt = (value = claims) => `x.${Buffer.from(JSON.stringify(value)).toString('base64url')}.x`;
const oidc = (overrides = {}, deps = {}) => resolveAliyunCredentials({ mode: 'oidc-sts', roleKind: 'builder', trust,
  roleSessionName: 'fixture-session', ...overrides }, { requestOidcToken: async () => jwt(), assumeRoleWithOidc: async () => ({ Credentials: {
    AccessKeyId: 'fixture-temp-id', AccessKeySecret: 'fixture-temp-secret', SecurityToken: 'fixture-temp-token', Expiration: '2099-01-01T00:00:00Z',
  } }), now: () => new Date('2026-01-01T00:00:00Z'), ...deps });

test('OIDC exchanges a validated GitHub subject for expiring STS credentials', async () => {
  const value = await oidc();
  assert.equal(value.mode, 'oidc-sts'); assert.equal(value.roleKind, 'builder'); assert.equal(value.securityToken, 'fixture-temp-token');
});

for (const [name, patch, code] of [
  ['repository', { repository: 'attacker/fork', sub: 'repo:attacker/fork:ref:refs/heads/zdt-next' }, 'OIDC_SUBJECT_NOT_ALLOWED'],
  ['ref', { ref: 'refs/heads/feature', sub: 'repo:Ethan7586/zhudatuan:ref:refs/heads/feature' }, 'OIDC_SUBJECT_NOT_ALLOWED'],
  ['workflow', { job_workflow_ref: 'Ethan7586/zhudatuan/.github/workflows/other.yml@refs/heads/zdt-next' }, 'OIDC_SUBJECT_NOT_ALLOWED'],
  ['audience', { aud: 'wrong' }, 'OIDC_AUDIENCE_MISMATCH'],
  ['pull request subject', { sub: 'repo:Ethan7586/zhudatuan:pull_request' }, 'OIDC_SUBJECT_NOT_ALLOWED'],
  ['event', { event_name: 'pull_request' }, 'OIDC_SUBJECT_NOT_ALLOWED'],
]) test(`OIDC rejects ${name} mismatch`, async () => {
  await assert.rejects(oidc({}, { requestOidcToken: async () => jwt({ ...claims, ...patch }) }), (error) => error.code === code);
});

test('environment trust requires the exact protected environment subject', async () => {
  const environmentTrust = { ...trust, ref: 'environment:production' };
  const environmentClaims = { ...claims, ref: 'refs/heads/zdt-next', sub: 'repo:Ethan7586/zhudatuan:environment:production' };
  await assert.doesNotReject(oidc({ trust: environmentTrust }, { requestOidcToken: async () => jwt(environmentClaims) }));
});

test('expired STS credentials are rejected and a later call can safely refresh', async () => {
  let calls = 0;
  const audit = [];
  const assumeRoleWithOidc = async () => ({ Credentials: { AccessKeyId: 'fixture-id', AccessKeySecret: 'fixture-secret', SecurityToken: 'fixture-token',
    Expiration: ++calls === 1 ? '2025-01-01T00:00:00Z' : '2099-01-01T00:00:00Z' } });
  const value = await oidc({ maxCredentialAttempts: 2 }, { assumeRoleWithOidc, audit: (entry) => audit.push(entry) });
  assert.equal(calls, 2); assert.equal(value.audit.credentialAttempts, 2); assert.equal(audit.length, 1);
});

test('OIDC failure never falls back to static credentials', async () => {
  await assert.rejects(oidc({ accessKeyId: 'fixture-static', accessKeySecret: 'fixture-static' }, {
    assumeRoleWithOidc: async () => { throw Object.assign(new Error('denied'), { status: 403 }); },
  }), (error) => error.code === 'STS_ASSUME_ROLE_FAILED');
});

test('static credentials require explicit compatibility approval', async () => {
  await assert.rejects(resolveAliyunCredentials({ mode: 'static-access-key', roleKind: 'observer', allowStatic: false,
    accessKeyId: 'fixture-id', accessKeySecret: 'fixture-secret' }), (error) => error.code === 'STATIC_ACCESS_KEY_NOT_EXPLICITLY_ALLOWED');
});

test('explicit static compatibility emits a deprecation warning', async () => {
  const warnings = [];
  await resolveAliyunCredentials({ mode: 'static-access-key', roleKind: 'observer', allowStatic: true,
    accessKeyId: 'fixture-id', accessKeySecret: 'fixture-secret' }, { warning: (value) => warnings.push(value) });
  assert.equal(warnings.length, 1); assert.match(warnings[0], /deprecated/);
});

test('credential JSON serialization redacts all credential material', async () => {
  const value = await oidc(); const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /fixture-temp-secret|fixture-temp-token/); assert.match(serialized, /REDACTED/);
  assert.equal(credentialSummary(value).trust.roleConfigured, true);
});

test('observer cannot write', () => assert.throws(() => assertRoleCapability('observer', 'oss:artifact:get-put'), /cannot use/));
test('builder cannot seal or deploy', () => assert.throws(() => assertRoleCapability('builder', 'oss:seal:get-put'), /cannot use/));
test('releaser cannot build source', () => assert.throws(() => assertRoleCapability('releaser', 'source:build'), /cannot use/));

test('security error codes remain machine-classified', () => {
  const error = Object.assign(new Error('subject'), { code: 'OIDC_SUBJECT_NOT_ALLOWED' });
  assert.equal(deliveryErrorContract(error).category, 'SECURITY_DENIAL');
});

test('RAM policy templates contain no wildcard action or bucket-wide resource', async () => {
  const policy = JSON.parse(await source('release-engine/policies/aliyun-ram-policy-template.json'));
  for (const role of Object.values(policy.roles)) {
    assert.ok(role.actions.every((action) => action !== 'oss:*'));
    assert.ok(role.resources.every((resource) => !resource.endsWith(':${BUCKET}/*') && resource !== '*'));
  }
});

test('workflow identity contracts are explicit and grant no unused id-token permission', async () => {
  const [prepare, deploy, control] = await Promise.all([
    source('../.github/workflows/prepare-artifact-aliyun.yml'), source('../.github/workflows/deploy-prepared-aliyun.yml'), source('../.github/workflows/delivery-1-4-3.yml'),
  ]);
  assert.match(prepare, /role_kind:[\s\S]*AI_DELIVERY_ROLE_KIND/); assert.match(deploy, /role_kind:[\s\S]*AI_DELIVERY_ROLE_KIND/);
  assert.doesNotMatch(`${prepare}\n${deploy}\n${control}`, /id-token:\s*write/);
  assert.match(control, /auth_mode: static-access-key/);
});

test('Doctor and sealed deploy use exact object reads before any bounded generation list', async () => {
  const [doctor, lifecycle] = await Promise.all([source('release-engine/src/doctor.mjs'), source('release-engine/src/seal-lifecycle.mjs')]);
  assert.doesNotMatch(doctor, /client\.listPrefix/);
  assert.ok(lifecycle.indexOf('if (final)') < lifecycle.indexOf('client.listPrefix(paths.root)'));
});

test('remaining ListObjects calls are constrained to constructed prefixes', async () => {
  const oss = await source('release-engine/src/oss.mjs');
  assert.doesNotMatch(oss, /listPrefix\(['"]{2}\)/);
  assert.match(oss, /listPrefix\(prefix\)/);
});
