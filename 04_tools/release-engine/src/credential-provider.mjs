import { DeliveryError, invariant } from './errors.mjs';

export const AUTH_MODES = Object.freeze(['oidc-sts', 'static-access-key', 'fixture']);
export const ROLE_KINDS = Object.freeze(['observer', 'builder', 'releaser']);

export async function resolveAliyunCredentials(options, dependencies = {}) {
  const mode = exact(options.mode, AUTH_MODES, 'AUTH_MODE_INVALID');
  const roleKind = exact(options.roleKind, ROLE_KINDS, 'AUTH_ROLE_KIND_INVALID');
  if (mode === 'static-access-key') return resolveStaticAccessKeyCredentials(options, dependencies);
  if (mode === 'fixture') return resolveFixtureCredentials(options);
  const maxAttempts = Number(options.maxCredentialAttempts ?? 2);
  invariant(Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 3, 'STS_REFRESH_BUDGET_INVALID', 'STS refresh budget must be 1-3 attempts');
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try { return await resolveOidcStsCredentials(options, { ...dependencies, credentialAttempt: attempt, maxCredentialAttempts: maxAttempts }); }
    catch (error) {
      if (error?.code !== 'STS_CREDENTIAL_EXPIRED' || attempt === maxAttempts) throw error;
      dependencies.audit?.({ event: 'sts-credential-refresh', attempt, maxAttempts, roleKind });
    }
  }
}

export function resolveStaticAccessKeyCredentials(options, dependencies = {}) {
  invariant(options.mode === 'static-access-key', 'STATIC_ACCESS_KEY_NOT_EXPLICITLY_ALLOWED', 'Static Access Key mode must be selected explicitly');
  invariant(options.allowStatic === true, 'STATIC_ACCESS_KEY_NOT_EXPLICITLY_ALLOWED', 'Static Access Key compatibility requires explicit approval');
  const roleKind = exact(options.roleKind, ROLE_KINDS, 'AUTH_ROLE_KIND_INVALID');
  const accessKeyId = required(options.accessKeyId, 'OSS_ACCESS_KEY_ID_REQUIRED');
  const accessKeySecret = required(options.accessKeySecret, 'OSS_ACCESS_KEY_SECRET_REQUIRED');
  dependencies.warning?.('SECURITY WARNING: static-access-key is deprecated compatibility mode; migrate to oidc-sts.');
  return credential({ mode: 'static-access-key', roleKind, accessKeyId, accessKeySecret,
    securityToken: options.securityToken || null, expiresAt: null, subject: null, audience: null,
    trust: options.trust ?? {}, source: 'explicit-static-compatibility', deprecated: true });
}

async function resolveOidcStsCredentials(options, dependencies) {
  const trust = validateTrustConfiguration(options.trust);
  const requestToken = dependencies.requestOidcToken ?? requestGithubOidcToken;
  const exchange = dependencies.assumeRoleWithOidc ?? assumeRoleWithOidc;
  let oidcToken;
  try { oidcToken = await requestToken({ audience: trust.audience, environment: dependencies.environment ?? process.env }); }
  catch (cause) { throw wrapped('OIDC_TOKEN_REQUIRED', 'GitHub OIDC token could not be obtained', cause); }
  const claims = decodeJwtClaims(oidcToken);
  validateClaims(claims, trust);
  let response;
  try {
    response = await exchange({ oidcToken, providerArn: trust.providerArn, roleArn: trust.roleArn,
      roleSessionName: options.roleSessionName, durationSeconds: options.durationSeconds ?? 900, policy: options.policy });
  } catch (cause) { throw wrapped('STS_ASSUME_ROLE_FAILED', 'Alibaba Cloud AssumeRoleWithOIDC failed', cause); }
  const value = response.Credentials ?? response.credentials;
  invariant(value, 'STS_ASSUME_ROLE_FAILED', 'STS response did not contain Credentials');
  const expiresAt = new Date(value.Expiration ?? value.expiration);
  invariant(Number.isFinite(expiresAt.getTime()), 'STS_CREDENTIAL_EXPIRED', 'STS credential expiration is invalid');
  const now = (dependencies.now ?? (() => new Date()))();
  invariant(expiresAt.getTime() > now.getTime() + 60_000, 'STS_CREDENTIAL_EXPIRED', 'STS credential is expired or too close to expiry', {
    expiresAt: expiresAt.toISOString(), retryable: true, nextSafeAction: 'refresh-oidc-token-and-repeat-assume-role',
  });
  return credential({ mode: 'oidc-sts', roleKind: options.roleKind,
    accessKeyId: required(value.AccessKeyId ?? value.accessKeyId, 'STS_ASSUME_ROLE_FAILED'),
    accessKeySecret: required(value.AccessKeySecret ?? value.accessKeySecret, 'STS_ASSUME_ROLE_FAILED'),
    securityToken: required(value.SecurityToken ?? value.securityToken, 'STS_ASSUME_ROLE_FAILED'),
    expiresAt: expiresAt.toISOString(), subject: claims.sub, audience: claims.aud, trust,
    source: 'github-oidc-alibaba-sts', deprecated: false,
    audit: { credentialAttempts: dependencies.credentialAttempt, maxCredentialAttempts: dependencies.maxCredentialAttempts } });
}

export function validateTrustConfiguration(trust = {}) {
  const repository = required(trust.repository, 'OIDC_TRUST_CONFIGURATION_INVALID');
  const ref = required(trust.ref, 'OIDC_TRUST_CONFIGURATION_INVALID');
  const workflow = required(trust.workflow, 'OIDC_TRUST_CONFIGURATION_INVALID');
  const audience = required(trust.audience, 'OIDC_TRUST_CONFIGURATION_INVALID');
  invariant(repository === 'Ethan7586/zhudatuan', 'OIDC_SUBJECT_NOT_ALLOWED', 'OIDC trust is restricted to Ethan7586/zhudatuan');
  invariant(ref === 'refs/heads/zdt-next' || /^environment:[A-Za-z0-9_.-]+$/.test(ref), 'OIDC_SUBJECT_NOT_ALLOWED', 'OIDC trust requires zdt-next or a protected environment');
  return Object.freeze({ repository, ref, workflow, audience,
    eventNames: Object.freeze([...(trust.eventNames ?? ['push', 'workflow_dispatch'])]),
    providerArn: required(trust.providerArn, 'TRUST_RELATIONSHIP_UNVERIFIED'),
    roleArn: required(trust.roleArn, 'TRUST_RELATIONSHIP_UNVERIFIED') });
}

export function validateClaims(claims, trust) {
  invariant(matchesAudience(claims.aud, trust.audience), 'OIDC_AUDIENCE_MISMATCH', 'OIDC audience does not match the configured Alibaba RAM OIDC provider');
  const expectedSubject = trust.ref.startsWith('environment:')
    ? `repo:${trust.repository}:environment:${trust.ref.slice('environment:'.length)}`
    : `repo:${trust.repository}:ref:${trust.ref}`;
  invariant(claims.repository === trust.repository && claims.sub === expectedSubject,
    'OIDC_SUBJECT_NOT_ALLOWED', 'OIDC subject is not an allowed repository branch or environment');
  if (!trust.ref.startsWith('environment:')) invariant(claims.ref === trust.ref, 'OIDC_SUBJECT_NOT_ALLOWED', 'OIDC ref is not allowed');
  const workflow = claims.job_workflow_ref ?? claims.workflow_ref ?? claims.workflow;
  invariant(typeof workflow === 'string' && workflow.includes(trust.workflow), 'OIDC_SUBJECT_NOT_ALLOWED', 'OIDC workflow identity is not allowed');
  if (claims.event_name) invariant(trust.eventNames.includes(claims.event_name), 'OIDC_SUBJECT_NOT_ALLOWED', 'OIDC event is not allowed');
}

export function credentialSummary(value) {
  return Object.freeze({ provider: value.provider, mode: value.mode, roleKind: value.roleKind,
    accessKeyId: value.accessKeyId ? `${value.accessKeyId.slice(0, 4)}…[REDACTED]` : null,
    accessKeySecret: '[REDACTED]', securityToken: value.securityToken ? '[REDACTED]' : null,
    expiresAt: value.expiresAt, subject: summarize(value.subject), audience: summarize(value.audience),
    trust: value.trust ? { repository: value.trust.repository, ref: value.trust.ref, workflow: value.trust.workflow,
      audience: summarize(value.trust.audience), providerConfigured: Boolean(value.trust.providerArn), roleConfigured: Boolean(value.trust.roleArn) } : null,
    source: value.source, deprecated: value.deprecated, audit: value.audit ?? null });
}

async function requestGithubOidcToken({ audience, environment }) {
  const requestUrl = required(environment.ACTIONS_ID_TOKEN_REQUEST_URL, 'OIDC_TOKEN_REQUIRED');
  const requestToken = required(environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN, 'OIDC_TOKEN_REQUIRED');
  const url = new URL(requestUrl);
  url.searchParams.set('audience', audience);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${requestToken}` } });
  if (!response.ok) throw Object.assign(new Error(`GitHub OIDC HTTP ${response.status}`), { status: response.status });
  return required((await response.json()).value, 'OIDC_TOKEN_REQUIRED');
}

async function assumeRoleWithOidc({ oidcToken, providerArn, roleArn, roleSessionName, durationSeconds, policy }) {
  invariant(Number.isInteger(durationSeconds) && durationSeconds >= 900, 'STS_DURATION_INVALID', 'STS duration must be at least 900 seconds');
  const body = new URLSearchParams({ Action: 'AssumeRoleWithOIDC', Version: '2015-04-01', Format: 'JSON',
    OIDCProviderArn: providerArn, RoleArn: roleArn, OIDCToken: oidcToken,
    RoleSessionName: required(roleSessionName, 'STS_ROLE_SESSION_NAME_REQUIRED'), DurationSeconds: String(durationSeconds) });
  if (policy) body.set('Policy', JSON.stringify(policy));
  const response = await fetch('https://sts.aliyuncs.com/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const value = await response.json();
  if (!response.ok || value.Code) throw Object.assign(new Error(value.Message ?? `STS HTTP ${response.status}`), { status: response.status, code: value.Code });
  return value;
}

function resolveFixtureCredentials(options) {
  invariant(options.allowFixture === true && options.fixture === true, 'FIXTURE_CREDENTIALS_FORBIDDEN', 'Fixture credentials are test-only');
  for (const value of [options.accessKeyId, options.accessKeySecret, options.securityToken]) {
    invariant(String(value ?? '').startsWith('fixture-'), 'FIXTURE_CREDENTIALS_FORBIDDEN', 'Fixture credentials must use obvious fixture values');
  }
  return credential({ ...options, mode: 'fixture', expiresAt: options.expiresAt ?? '2099-01-01T00:00:00.000Z', source: 'isolated-test-fixture', deprecated: false });
}

function credential(value) {
  const result = { provider: value.mode === 'oidc-sts' ? 'github-oidc-alibaba-sts' : value.mode, ...value };
  Object.defineProperty(result, 'toJSON', { enumerable: false, value: () => credentialSummary(result) });
  return Object.freeze(result);
}

function decodeJwtClaims(token) {
  try { return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8')); }
  catch { throw new DeliveryError('OIDC_TOKEN_REQUIRED', 'OIDC token is not a JWT'); }
}
function matchesAudience(actual, expected) { return Array.isArray(actual) ? actual.includes(expected) : actual === expected; }
function summarize(value) { if (!value) return null; const text = Array.isArray(value) ? value.join(',') : String(value); return `${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`; }
function exact(value, choices, code) { invariant(choices.includes(value), code, `${code}: ${choices.join(', ')}`); return value; }
function required(value, code) { if (value === undefined || value === null || value === '') throw new DeliveryError(code, code); return value; }
function wrapped(code, message, cause) { return new DeliveryError(code, message, { status: cause?.status, retryable: false, nextSafeAction: 'repair-oidc-trust-and-rerun-doctor' }); }

export const ROLE_CAPABILITIES = Object.freeze({
  observer: Object.freeze(['github:runners:read', 'github:mainline:read', 'github:closures:read', 'oss:release-index:get', 'oss:seal:get', 'oss:receipt:get', 'oss:bounded-prefix:list']),
  builder: Object.freeze(['github:runners:read', 'oss:runner-request:get-put', 'oss:slot-claim:get-put', 'oss:artifact:get-put', 'oss:provenance:put', 'oss:uploaded-receipt:put', 'oss:bounded-prefix:list']),
  releaser: Object.freeze(['github:runners:read', 'oss:artifact:get', 'oss:seal:get-put', 'oss:writer-lease:get-put', 'oss:validation-receipt:put', 'oss:deployment-receipt:put', 'oss:bounded-prefix:list', 'ssh:physical-target:deploy']),
});

export function assertRoleCapability(roleKind, capability) {
  invariant(ROLE_CAPABILITIES[roleKind]?.includes(capability), 'ROLE_CAPABILITY_DENIED', `${roleKind} cannot use ${capability}`, {
    roleKind, capability, retryable: false, nextSafeAction: 'use-the-minimum-correct-role-without-capability-escalation',
  });
}
