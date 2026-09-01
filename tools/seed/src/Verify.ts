import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { localSeedEnvironment } from '@shop/config/server';
import { COMMERCE_OPERATIONS, CONTRACT_VERSION } from '@shop/contract';
import { KmsClient } from '../../../services/commerce/src/foundation/infrastructure/KmsClient';
import { HttpObjectStore } from '../../../services/commerce/src/foundation/infrastructure/ObjectStore';
import { localFetch } from '@shop/localinfra';
import { localSecret } from './LocalSecrets';

const CURRENT_SCHEMA_RELATIONS = 246;
const CURRENT_MIGRATIONS = 146;
const LOCAL_ACCOUNT = 'ethan';
const LOCAL_MOBILE = '+8613800138000';

const environment = localSeedEnvironment();
const [connectionString, objectToken, ethanPassword, identityKey] = await Promise.all([
  localSecret(environment.adminDatabaseConnectionRef),
  localSecret(environment.objectStoreTokenRef),
  localSecret(environment.ethanPasswordRef),
  localSecret(environment.identityKeyRef),
]);
await Promise.all([expectReady('https://127.0.0.1:8443/health/ready'), expectReady('https://127.0.0.1:8444/health/ready'), expectReady('https://127.0.0.1:8445/health/ready'), expectReady('http://127.0.0.1:3001/health/ready')]);
const kms = new KmsClient(environment.kmsEndpoint, environment.kmsBearerToken);
await resetLocalVerificationRateLimits(connectionString, identityKey, kms);
const context = { verification: randomUUID() };
const envelope = await kms.encrypt('evidence', 'local/verification', 'p0-verification', context);
if ((await kms.decrypt('evidence', 'local/verification', envelope.ciphertext, context)) !== 'p0-verification') throw new Error('LOCAL_KMS_ROUNDTRIP_FAILED');

const objects = new HttpObjectStore(environment.objectStoreEndpoint, objectToken);
const bytes = new TextEncoder().encode(`P0 ${new Date().toISOString()}`);
const path = `verification/${randomUUID()}.txt`;
const upload = await objects.create(path, 'text/plain');
await upload.append(bytes);
const stored = await upload.complete();
if (stored.sha256 !== createHash('sha256').update(bytes).digest('hex') || !Buffer.from(await objects.read(stored.reference, 1024)).equals(Buffer.from(bytes))) {
  throw new Error('LOCAL_OBJECT_ROUNDTRIP_FAILED');
}

const challengeBefore = await challengeSecretCount(connectionString);
await issueChallenge('storefront', `localverify-${randomUUID()}`, 'password_reset');
if ((await challengeSecretCount(connectionString)) <= challengeBefore) throw new Error('LOCAL_CHALLENGE_ENVELOPE_MISSING');
await verifyEmployeeSession(ethanPassword);

const database = new Client({ connectionString });
await database.connect();
try {
  const result = await database.query<{ tables: string; migrations: string; operations: string; publicobjects: string }>(`select
    (select count(*) from information_schema.tables where table_schema not in('pg_catalog','information_schema')) tables,
    (select count(*) from supabase_migrations.schema_migrations) migrations,
    (select count(*) from runtime.operation) operations,
    (select count(*) from information_schema.tables where table_schema='public') publicobjects`);
  const counts = result.rows[0];
  if (!counts || Number(counts.tables) < CURRENT_SCHEMA_RELATIONS || Number(counts.migrations) < CURRENT_MIGRATIONS || Number(counts.operations) < COMMERCE_OPERATIONS.length || Number(counts.publicobjects) !== 0) {
    throw new Error(`LOCAL_RUNTIME_COUNTS_INVALID:${JSON.stringify(counts)}`);
  }
  process.stdout.write(`LOCAL_P0_VERIFIED tables=${counts.tables} migrations=${counts.migrations} operations=${counts.operations} public=${counts.publicobjects}\n`);
} finally {
  await database.end();
}

async function expectReady(url: string): Promise<void> {
  const response = await localFetch(url);
  if (!response.ok) throw new Error(`LOCAL_HEALTH_FAILED:${url}:${response.status}`);
}

async function verifyEncryptedStore(connectionString: string, store: string, plaintext: string): Promise<void> {
  const database = new Client({ connectionString });
  await database.connect();
  try {
    const result = await database.query<{ address_ciphertext: string | null; address_token: string | null }>('select address_ciphertext,address_token from partner.store where id=$1', [store]);
    const found = result.rows[0];
    if (!found?.address_ciphertext || found.address_ciphertext.includes(plaintext) || !/^[0-9a-f]{64}$/.test(found.address_token ?? '')) {
      throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
    }
  } finally {
    await database.end();
  }
}

async function challengeSecretCount(connectionString: string): Promise<number> {
  const database = new Client({ connectionString });
  await database.connect();
  try {
    const result = await database.query<{ count: string }>('select count(*) count from identity.challengesecret');
    return Number(result.rows[0]?.count ?? 0);
  } finally {
    await database.end();
  }
}

async function resetLocalVerificationRateLimits(connectionString: string, identityKey: string, kms: KmsClient): Promise<void> {
  const database = new Client({ connectionString });
  await database.connect();
  try {
    const principal = 'principal:zhudatuan:owner:ethan:v1';
    const profile = await database.query<{ mobile_ciphertext: string | null }>('select mobile_ciphertext from member.profile where principal_id=$1', [principal]);
    const ciphertext = profile.rows[0]?.mobile_ciphertext;
    const mobile = ciphertext ? await kms.decrypt('pii', 'identity/mobile', ciphertext, { principal }) : LOCAL_MOBILE;
    const digest = (value: string) => createHmac('sha256', identityKey).update(value).digest('hex');
    await database.query("delete from identity.loginattempt where subject_hash=any($1::text[]) and client_hash in('login','stepup')", [[digest(LOCAL_ACCOUNT), digest(mobile), digest(`${principal}:${mobile}`)]]);
  } finally {
    await database.end();
  }
}

type ChallengePurpose = 'login' | 'password_reset' | 'phone_change' | 'enrollment';

async function issueChallenge(target: AuthTarget, destination: string, purpose: ChallengePurpose): Promise<Readonly<{ id: string }>> {
  const bootstrap = await authBootstrap(target);
  const response = await localFetch('http://127.0.0.1:3001/api/v1/identity/challenges', {
    method: 'POST',
    headers: {
      ...bootstrapCommand(bootstrap),
      'content-type': 'application/json',
      'idempotency-key': randomUUID(),
      'x-client-version': '0.0.0',
      'x-contract-version': CONTRACT_VERSION,
      'x-device-id': `local-${randomUUID()}`,
      'x-real-ip': localPeer(),
      'x-request-id': randomUUID(),
    },
    body: JSON.stringify({ destination, purpose }),
  });
  if (response.status !== 202) throw new Error(`LOCAL_CHALLENGE_HTTP_${response.status}:${await response.text()}`);
  const payload: unknown = await response.json();
  const id = payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Readonly<Record<string, unknown>>).id : null;
  if (typeof id !== 'string') throw new Error('LOCAL_CHALLENGE_RESPONSE_INVALID');
  return Object.freeze({ id });
}

async function decryptChallengeCode(challenge: string, purpose: 'login' | 'stepup'): Promise<string> {
  const database = new Client({ connectionString });
  await database.connect();
  try {
    const result = await database.query<{ code_ciphertext: string }>('select code_ciphertext from identity.challengesecret where challenge_id=$1', [challenge]);
    const ciphertext = result.rows[0]?.code_ciphertext;
    if (!ciphertext) throw new Error('LOCAL_CHALLENGE_SECRET_MISSING');
    return await kms.decrypt('pii', 'identity/challenge', ciphertext, { challenge, purpose });
  } finally {
    await database.end();
  }
}

async function completeStepup(session: AuthenticatedSession): Promise<void> {
  const started = await localFetch('http://127.0.0.1:3001/api/v1/identity/stepup/challenges', {
    method: 'POST',
    headers: { ...sessionHeaders(session), 'content-type': 'application/json', 'idempotency-key': randomUUID() },
    body: '{}',
  });
  if (started.status !== 202) throw new Error(`LOCAL_STEPUP_START_HTTP_${started.status}:${await started.text()}`);
  const payload: unknown = await started.json();
  const challenge = payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Readonly<Record<string, unknown>>).id : null;
  if (typeof challenge !== 'string') throw new Error('LOCAL_STEPUP_RESPONSE_INVALID');
  const code = await decryptChallengeCode(challenge, 'stepup');
  const completed = await localFetch('http://127.0.0.1:3001/api/v1/identity/stepup/verifications', {
    method: 'POST',
    headers: { ...sessionHeaders(session), 'content-type': 'application/json', 'idempotency-key': randomUUID() },
    body: JSON.stringify({ challenge, code }),
  });
  if (completed.status !== 200) throw new Error(`LOCAL_STEPUP_COMPLETE_HTTP_${completed.status}:${await completed.text()}`);
}

async function sessionAccessVersion(session: AuthenticatedSession): Promise<number> {
  const response = await localFetch('http://127.0.0.1:3001/api/v1/identity/session', { headers: sessionHeaders(session) });
  if (response.status !== 200) throw new Error(`LOCAL_SESSION_SNAPSHOT_HTTP_${response.status}:${await response.text()}`);
  const payload: unknown = await response.json();
  const value = payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Readonly<Record<string, unknown>>).accessVersion : null;
  const assurance = payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Readonly<Record<string, unknown>>).assurance : null;
  const accessVersion = Number(value);
  if (!Number.isSafeInteger(accessVersion) || accessVersion < 1) throw new Error('LOCAL_SESSION_ACCESS_VERSION_INVALID');
  if (assurance === null || typeof assurance !== 'object' || Array.isArray(assurance) || (assurance as Readonly<Record<string, unknown>>).level !== 3 || typeof (assurance as Readonly<Record<string, unknown>>).verified !== 'string') {
    throw new Error(`LOCAL_SESSION_STEPUP_INVALID:${JSON.stringify(assurance)}`);
  }
  return accessVersion;
}

async function verifyEmployeeSession(password: string): Promise<void> {
  const token = () => randomBytes(32).toString('base64url');
  const bootstraps = await Promise.all([authBootstrap('storefront'), authBootstrap('console')]);
  const authenticate = (target: AuthTarget, credential: Readonly<Record<string, string>>) => {
    const bootstrap = bootstraps.find((item) => item.target === target)!;
    return localFetch('http://127.0.0.1:3001/api/v1/identity/sessions', {
      method: 'POST',
      headers: {
        ...bootstrapCommand(bootstrap),
        'content-type': 'application/json',
        'idempotency-key': randomUUID(),
        'x-client-version': '0.0.0',
        'x-contract-version': CONTRACT_VERSION,
        'x-device-id': `local-${randomUUID()}`,
        'x-real-ip': localPeer(),
        'x-request-id': randomUUID(),
      },
      body: JSON.stringify({ ...credential, target, authorization: { state: token(), nonce: token(), challenge: token() } }),
    });
  };
  const login = await authenticate('storefront', { method: 'password', subject: LOCAL_ACCOUNT, password });
  if (login.status !== 201) throw new Error(`LOCAL_EMPLOYEE_LOGIN_HTTP_${login.status}:${await login.text()}`);
  const storefront = authenticatedSession(login, 'storefront');
  const session = await localFetch('http://127.0.0.1:3001/api/v1/identity/session', {
    headers: sessionHeaders(storefront),
  });
  if (session.status !== 200) throw new Error(`LOCAL_EMPLOYEE_SESSION_HTTP_${session.status}:${await session.text()}`);
  const payload: unknown = await session.json();
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const storefrontAccessVersion = Number((payload as Readonly<Record<string, unknown>>).accessVersion);
  if (!Number.isSafeInteger(storefrontAccessVersion) || storefrontAccessVersion < 1) throw new Error('LOCAL_EMPLOYEE_SESSION_ACCESS_VERSION_INVALID');
  const permissions = (payload as Readonly<Record<string, unknown>>).permissions;
  if (!Array.isArray(permissions)) throw new Error('LOCAL_EMPLOYEE_SESSION_PERMISSIONS_INVALID');
  const required = [
    'catalog.listing.read',
    'pricing.offer.read',
    'inventory.read',
    'cart.read',
    'cart.manage',
    'checkout.create',
    'order.create',
    'order.read',
    'order.aftersale.apply',
    'benefit.read',
    'voucher.binding.read',
    'support.case.create',
    'observability.clienterror.create',
  ];
  const missing = required.filter((permission) => !permissions.includes(permission));
  if (missing.length > 0) throw new Error(`LOCAL_EMPLOYEE_SESSION_PERMISSIONS_MISSING:${missing.join(',')}`);
  const report = await localFetch('http://127.0.0.1:3001/api/v1/telemetry/clienterrors', {
    method: 'POST',
    headers: {
      ...sessionHeaders(storefront),
      'content-type': 'application/json',
      'idempotency-key': randomUUID(),
    },
    body: JSON.stringify({ surface: 'storefront', route: '/local/verify', message: 'local telemetry verification', stack: null, componentStack: null }),
  });
  if (report.status !== 202) throw new Error(`LOCAL_CLIENT_ERROR_HTTP_${report.status}:${await report.text()}`);
  const reported: unknown = await report.json();
  const faultCode = reported !== null && typeof reported === 'object' && !Array.isArray(reported) ? (reported as Readonly<Record<string, unknown>>).faultCode : null;
  if (typeof faultCode !== 'string') throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const operatorChallenge = await issueChallenge('console', LOCAL_ACCOUNT, 'login');
  const operatorCode = await decryptChallengeCode(operatorChallenge.id, 'login');
  const operatorLogin = await authenticate('console', { method: 'otp', subject: LOCAL_ACCOUNT, challenge: operatorChallenge.id, code: operatorCode });
  if (operatorLogin.status !== 201) throw new Error(`LOCAL_OPERATOR_LOGIN_HTTP_${operatorLogin.status}:${await operatorLogin.text()}`);
  const consoleSession = authenticatedSession(operatorLogin, 'console');
  await completeStepup(consoleSession);
  const consoleAccessVersion = await sessionAccessVersion(consoleSession);
  const navigation = await localFetch('http://127.0.0.1:3001/api/v1/navigation', {
    headers: { ...sessionHeaders(consoleSession), 'x-access-version': String(consoleAccessVersion), 'x-scope-hint': 'organization-platform-root' },
  });
  const navigationPayload = await navigation.text();
  if (navigation.status !== 200) throw new Error(`LOCAL_NAVIGATION_INVALID:${navigation.status}:${navigationPayload}`);
  const errors = await localFetch('http://127.0.0.1:3001/api/v1/telemetry/clienterrors?limit=20', {
    headers: { ...sessionHeaders(consoleSession), 'x-scope-hint': 'organization-platform-root' },
  });
  const errorsPayload = await errors.text();
  if (errors.status !== 200 || !errorsPayload.includes(faultCode)) throw new Error(`LOCAL_CLIENT_ERROR_READ_INVALID:${errors.status}:${faultCode}:${errorsPayload}`);
  const activeInvitations = await localFetch('http://127.0.0.1:3001/api/v1/identity/invitations?status=active&target=storefront&limit=100', {
    headers: sessionHeaders(consoleSession),
  });
  const activePayload: unknown = await activeInvitations.json();
  const activeItems = activePayload !== null && typeof activePayload === 'object' && !Array.isArray(activePayload) ? (activePayload as Readonly<Record<string, unknown>>).items : null;
  if (activeInvitations.status !== 200 || !Array.isArray(activeItems)) throw new Error(`LOCAL_INVITATION_READ_INVALID:${activeInvitations.status}:${JSON.stringify(activePayload)}`);
  for (const item of activeItems) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Readonly<Record<string, unknown>>;
    if (record.reason !== '本地统一权限验收' || record.membership_id !== 'membership-storefront-ethan-local') continue;
    const id = record.id;
    const version = Number(record.version);
    if (typeof id !== 'string' || !Number.isSafeInteger(version)) throw new Error(`LOCAL_INVITATION_CLEANUP_RECORD_INVALID:${JSON.stringify(record)}`);
    const cleanup = await localFetch(`http://127.0.0.1:3001/api/v1/identity/invitations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        ...sessionHeaders(consoleSession),
        'content-type': 'application/json',
        'idempotency-key': randomUUID(),
        'if-match': String(version),
      },
      body: JSON.stringify({ reason: '清理上次本地验收残留邀请' }),
    });
    if (cleanup.status !== 200) throw new Error(`LOCAL_INVITATION_CLEANUP_INVALID:${cleanup.status}:${await cleanup.text()}`);
  }
  const storeId = `store:local-${randomUUID()}`;
  const storeName = `本地门店-${storeId.slice(-12)}`;
  const saveStore = (body: unknown, etag?: string) =>
    localFetch(`http://127.0.0.1:3001/api/v1/organizations/stores/${encodeURIComponent(storeId)}`, {
      method: 'PUT',
      headers: {
        ...sessionHeaders(consoleSession),
        'content-type': 'application/json',
        'idempotency-key': randomUUID(),
        ...(etag === undefined ? {} : { 'if-match': etag }),
      },
      body: JSON.stringify(body),
    });
  const createdStore = await saveStore({ name: storeName, status: 'active', mall: 'mall-zhudatuan', regionCode: '310000', serviceRadiusMeters: 3000, address: '上海市测试路88号' }, '0');
  const storeEtag = createdStore.headers.get('etag');
  const storePayload: unknown = await createdStore.json();
  if (createdStore.status !== 200 || storeEtag === null || storePayload === null || typeof storePayload !== 'object' || Array.isArray(storePayload) || (storePayload as Readonly<Record<string, unknown>>).addressConfigured !== true)
    throw new Error(`LOCAL_STORE_CREATE_INVALID:${createdStore.status}:${storeEtag ?? 'NO_ETAG'}:${JSON.stringify(storePayload)}`);
  await verifyEncryptedStore(connectionString, storeId, '上海市测试路88号');
  const stores = await localFetch('http://127.0.0.1:3001/api/v1/organizations/stores?limit=100', {
    headers: sessionHeaders(consoleSession),
  });
  const storesPayload = await stores.text();
  if (stores.status !== 200 || !storesPayload.includes(storeId)) throw new Error(`LOCAL_STORES_READ_INVALID:${stores.status}:${storesPayload}`);
  const updatedStore = await saveStore({ name: storeName, status: 'suspended', mall: 'mall-zhudatuan', regionCode: '310000', serviceRadiusMeters: 5000, address: null }, storeEtag);
  const updatedStorePayload: unknown = await updatedStore.json();
  if (
    updatedStore.status !== 200 ||
    updatedStorePayload === null ||
    typeof updatedStorePayload !== 'object' ||
    Array.isArray(updatedStorePayload) ||
    (updatedStorePayload as Readonly<Record<string, unknown>>).addressConfigured !== false ||
    Number((updatedStorePayload as Readonly<Record<string, unknown>>).version) !== 1
  )
    throw new Error(`LOCAL_STORE_UPDATE_INVALID:${updatedStore.status}:${JSON.stringify(updatedStorePayload)}`);
  const staleStore = await saveStore({ name: '过期版本不应生效', status: 'active', mall: 'mall-zhudatuan', regionCode: '310000', serviceRadiusMeters: 5000, address: null }, storeEtag);
  if (staleStore.status !== 409) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const invitation = await localFetch('http://127.0.0.1:3001/api/v1/identity/invitations', {
    method: 'POST',
    headers: {
      ...sessionHeaders(consoleSession),
      'content-type': 'application/json',
      'idempotency-key': randomUUID(),
      'if-match': String(consoleAccessVersion),
    },
    body: JSON.stringify({ kind: 'signin', target: 'storefront', membershipId: 'membership-storefront-ethan-local', recipient: LOCAL_MOBILE, expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(), reason: '本地统一权限验收' }),
  });
  if (invitation.status !== 201) throw new Error(`LOCAL_INVITATION_CREATE_INVALID:${invitation.status}:${await invitation.text()}`);
  const invitationEtag = invitation.headers.get('etag');
  const created: unknown = await invitation.json();
  if (created === null || typeof created !== 'object' || Array.isArray(created)) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const invitationId = (created as Readonly<Record<string, unknown>>).id;
  const invitationCode = (created as Readonly<Record<string, unknown>>).code;
  const invitationVersion = (created as Readonly<Record<string, unknown>>).version;
  if (typeof invitationId !== 'string' || typeof invitationCode !== 'string' || invitationEtag === null || !['number', 'string'].includes(typeof invitationVersion)) {
    throw new Error(`LOCAL_INVITATION_RESPONSE_INVALID:${invitationEtag ?? 'NO_ETAG'}:${JSON.stringify(created)}`);
  }
  const resolveInvitation = () =>
    localFetch('http://127.0.0.1:3001/api/v1/identity/invitations/resolve', {
      method: 'POST',
      headers: {
        ...bootstrapCommand(bootstraps[0]),
        'content-type': 'application/json',
        'idempotency-key': randomUUID(),
        'x-client-version': '0.0.0',
        'x-contract-version': CONTRACT_VERSION,
        'x-request-id': randomUUID(),
      },
      body: JSON.stringify({ code: invitationCode, target: 'storefront' }),
    });
  const activeResolution = await resolveInvitation();
  if (activeResolution.status !== 200) throw new Error(`LOCAL_INVITATION_RESOLVE_INVALID:${activeResolution.status}:${await activeResolution.text()}`);
  const revoke = await localFetch(`http://127.0.0.1:3001/api/v1/identity/invitations/${encodeURIComponent(invitationId)}`, {
    method: 'DELETE',
    headers: {
      ...sessionHeaders(consoleSession),
      'content-type': 'application/json',
      'idempotency-key': randomUUID(),
      'if-match': invitationEtag,
    },
    body: JSON.stringify({ reason: '本地验证完成后撤销' }),
  });
  if (revoke.status !== 200) throw new Error(`LOCAL_INVITATION_REVOKE_INVALID:${revoke.status}:${await revoke.text()}`);
  const revokedResolution = await resolveInvitation();
  const revokedResolutionPayload: unknown = await revokedResolution.json();
  if (
    revokedResolution.status !== 400 ||
    revokedResolutionPayload === null ||
    typeof revokedResolutionPayload !== 'object' ||
    Array.isArray(revokedResolutionPayload) ||
    (revokedResolutionPayload as Readonly<Record<string, unknown>>).code !== 'INVITATION_INVALID'
  )
    throw new Error(`LOCAL_REVOKED_INVITATION_RESOLUTION_INVALID:${revokedResolution.status}:${JSON.stringify(revokedResolutionPayload)}`);
  const ledger = await localFetch('http://127.0.0.1:3001/api/v1/benefits/ledgers', { headers: sessionHeaders(storefront) });
  const ledgerPayload: unknown = await ledger.json();
  if (ledger.status !== 200 || ledgerPayload === null || typeof ledgerPayload !== 'object' || Array.isArray(ledgerPayload) || !Array.isArray((ledgerPayload as Readonly<Record<string, unknown>>).items))
    throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  await completeStepup(storefront);
  const listSessions = () => localFetch('http://127.0.0.1:3001/api/v1/identity/sessions', { headers: sessionHeaders(storefront) });
  const sessions = await listSessions();
  const sessionPayload: unknown = await sessions.json();
  const sessionItems = sessionPayload !== null && typeof sessionPayload === 'object' && !Array.isArray(sessionPayload) ? (sessionPayload as Readonly<Record<string, unknown>>).items : null;
  if (
    sessions.status !== 200 ||
    !Array.isArray(sessionItems) ||
    sessionItems.length < 2 ||
    sessionItems.filter((item) => item !== null && typeof item === 'object' && !Array.isArray(item) && (item as Readonly<Record<string, unknown>>).current === true).length !== 1
  )
    throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const revokeOthers = await localFetch('http://127.0.0.1:3001/api/v1/identity/sessions/others', {
    method: 'DELETE',
    headers: {
      ...sessionHeaders(storefront),
      'content-type': 'application/json',
      'idempotency-key': randomUUID(),
      'if-match': String(storefrontAccessVersion),
    },
    body: '{}',
  });
  const revoked: unknown = await revokeOthers.json();
  if (
    revokeOthers.status !== 200 ||
    revoked === null ||
    typeof revoked !== 'object' ||
    Array.isArray(revoked) ||
    typeof (revoked as Readonly<Record<string, unknown>>).revoked !== 'number' ||
    Number((revoked as Readonly<Record<string, unknown>>).revoked) < 1
  )
    throw new Error(`LOCAL_OTHER_SESSIONS_REVOKE_INVALID:${revokeOthers.status}:${JSON.stringify(revoked)}`);
  const remaining = await listSessions();
  const remainingPayload: unknown = await remaining.json();
  const remainingItems = remainingPayload !== null && typeof remainingPayload === 'object' && !Array.isArray(remainingPayload) ? (remainingPayload as Readonly<Record<string, unknown>>).items : null;
  if (remaining.status !== 200 || !Array.isArray(remainingItems) || remainingItems.length !== 1) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
}

type AuthTarget = 'console' | 'storefront';

interface AuthBootstrap {
  readonly cookie: string;
  readonly csrf: string;
  readonly target: AuthTarget;
}

interface AuthenticatedSession {
  readonly bearer: string;
  readonly cookie: string;
  readonly csrf: string;
  readonly target: AuthTarget;
}

async function authBootstrap(target: AuthTarget): Promise<AuthBootstrap> {
  const response = await localFetch('http://127.0.0.1:3001/api/v1/identity/providers', {
    headers: {
      'x-client-target': target,
      'x-client-version': '0.0.0',
      'x-contract-version': CONTRACT_VERSION,
      'x-device-id': `local-${randomUUID()}`,
      'x-request-id': randomUUID(),
    },
  });
  const value: unknown = await response.json();
  const csrf = value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>).csrf : null;
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  if (response.status !== 200 || typeof csrf !== 'string' || !cookie) throw new Error('LOCAL_AUTH_BOOTSTRAP_INVALID');
  return Object.freeze({ cookie, csrf, target });
}

function bootstrapCommand(bootstrap: AuthBootstrap): Readonly<Record<string, string>> {
  return Object.freeze({
    cookie: bootstrap.cookie,
    origin: bootstrap.target === 'console' ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:3000',
    'x-client-target': bootstrap.target,
    'x-csrf-token': bootstrap.csrf,
  });
}

function authenticatedSession(response: Response, target: AuthTarget): AuthenticatedSession {
  const cookies = response.headers.getSetCookie().map((value) => value.split(';', 1)[0]!);
  const session = cookieValue(cookies, `__Host-${target}-session`);
  const csrf = cookieValue(cookies, `__Host-${target}-csrf`);
  if (!session || !csrf) throw new Error('LOCAL_EMPLOYEE_SESSION_COOKIE_MISSING');
  return Object.freeze({ bearer: session, cookie: cookies.join('; '), csrf, target });
}

function sessionHeaders(session: AuthenticatedSession): Readonly<Record<string, string>> {
  return Object.freeze({
    authorization: `Bearer ${session.bearer}`,
    cookie: session.cookie,
    origin: session.target === 'console' ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:3000',
    'x-client-target': session.target,
    'x-client-version': '0.0.0',
    'x-contract-version': CONTRACT_VERSION,
    'x-csrf-token': session.csrf,
    'x-device-id': `local-${randomUUID()}`,
    'x-real-ip': localPeer(),
    'x-request-id': randomUUID(),
  });
}

function cookieValue(cookies: readonly string[], name: string): string | null {
  const prefix = `${name}=`;
  const value = cookies.find((cookie) => cookie.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

function localPeer(): string {
  return `2001:db8:${randomBytes(2).toString('hex')}::1`;
}
