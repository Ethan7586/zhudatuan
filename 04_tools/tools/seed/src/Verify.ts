import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { localSeedEnvironment } from '@shop/config/server';
import { COMMERCE_OPERATIONS, CONTRACT_VERSION } from '@shop/contract';
import { KmsClient } from '../../../../01_core_hexin/services/commerce/src/foundation/infrastructure/KmsClient';
import { HttpObjectStore } from '../../../../01_core_hexin/services/commerce/src/foundation/infrastructure/ObjectStore';
import { localFetch } from '@shop/localinfra';
import { localSecret } from './LocalSecrets';

const CURRENT_SCHEMA_RELATIONS = 246;
const CURRENT_MIGRATIONS = 142;

const environment = localSeedEnvironment();
const [connectionString, objectToken, ethanPassword, identityKey] = await Promise.all([
  localSecret(environment.adminDatabaseConnectionRef),
  localSecret(environment.objectStoreTokenRef),
  localSecret(environment.ethanPasswordRef),
  localSecret(environment.identityKeyRef),
]);
await Promise.all([
  expectReady('https://127.0.0.1:8443/health/ready'),
  expectReady('https://127.0.0.1:8444/health/ready'),
  expectReady('https://127.0.0.1:8445/health/ready'),
  expectReady('http://127.0.0.1:3001/health/ready'),
]);

const kms = new KmsClient(environment.kmsEndpoint, environment.kmsBearerToken);
const context = { verification: randomUUID() };
const envelope = await kms.encrypt('local/verification', 'p0-verification', context);
if (await kms.decrypt('local/verification', envelope.ciphertext, context) !== 'p0-verification') throw new Error('LOCAL_KMS_ROUNDTRIP_FAILED');

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
const challenge = await localFetch('http://127.0.0.1:3001/api/v1/identity/challenges', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'idempotency-key': randomUUID(),
    origin: 'http://127.0.0.1:3000',
    'x-client-version': '0.0.0',
    'x-contract-version': CONTRACT_VERSION,
    'x-device-id': `local-${randomUUID()}`,
    'x-request-id': randomUUID(),
  },
  body: JSON.stringify({ destination: '13800138000', purpose: 'password_reset' }),
});
if (challenge.status !== 202) throw new Error(`LOCAL_CHALLENGE_HTTP_${challenge.status}:${await challenge.text()}`);
if (await challengeSecretCount(connectionString) <= challengeBefore) throw new Error('LOCAL_CHALLENGE_ENVELOPE_MISSING');
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
  if (!counts || Number(counts.tables) < CURRENT_SCHEMA_RELATIONS || Number(counts.migrations) < CURRENT_MIGRATIONS
    || Number(counts.operations) < COMMERCE_OPERATIONS.length || Number(counts.publicobjects) !== 0) {
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
    const result = await database.query<{ address_ciphertext: string | null; address_token: string | null }>(
      'select address_ciphertext,address_token from partner.store where id=$1', [store]);
    const found = result.rows[0];
    if (!found?.address_ciphertext || found.address_ciphertext.includes(plaintext) || !/^[0-9a-f]{64}$/.test(found.address_token ?? '')) {
      throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
    }
  } finally {
    await database.end();
  }
}

async function verifyInvitationToken(connectionString: string, invitation: string, code: string, key: string): Promise<void> {
  const database = new Client({ connectionString });
  await database.connect();
  try {
    const result = await database.query<{ token_hash: string }>('select token_hash from member.invite where id=$1', [invitation]);
    const stored = result.rows[0]?.token_hash;
    const expected = createHmac('sha256', key).update(code.trim().toLowerCase()).digest('hex');
    if (stored !== expected) throw new Error('LOCAL_INVITATION_TOKEN_DRIFT');
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

async function localOwnerScope(connectionString: string): Promise<Readonly<{ mall: string; tenant: string }>> {
  const database = new Client({ connectionString });
  await database.connect();
  try {
    const result = await database.query<{ mall: string; tenant: string }>(`select mall.id mall,membership.organization_id tenant
      from access.platformowner owner
      join access.membership membership on membership.id=owner.membership_id and membership.status='active'
      join organization.unitclosure closure on closure.ancestor_id=membership.organization_id
      join organization.organization mall on mall.id=closure.descendant_id and mall.kind='mall' and mall.status='active'
      where owner.singleton=true and owner.state='active'
      order by mall.id limit 1`);
    const scope = result.rows[0];
    if (!scope) throw new Error('LOCAL_OWNER_SCOPE_MISSING');
    return scope;
  } finally {
    await database.end();
  }
}

async function verifyEmployeeSession(password: string): Promise<void> {
  const token = () => randomBytes(32).toString('base64url');
  const authorization = { state: token(), nonce: token(), challenge: token() };
  const authenticate = (membership?: string) => localFetch('http://127.0.0.1:3001/api/v1/identity/sessions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': randomUUID(),
      origin: 'http://127.0.0.1:3000',
      'x-client-version': '0.0.0',
      'x-contract-version': CONTRACT_VERSION,
      'x-device-id': `local-${randomUUID()}`,
      'x-request-id': randomUUID(),
    },
    body: JSON.stringify({ provider: 'password', subject: 'ethan', password, authorization, ...(membership === undefined ? {} : { membership }) }),
  });
  let login = await authenticate();
  let operatorMembership: string | undefined;
  if (login.status === 200) {
    const selection: unknown = await login.json();
    if (selection === null || typeof selection !== 'object' || Array.isArray(selection)) throw new Error('LOCAL_EMPLOYEE_MEMBERSHIP_SELECTION_INVALID');
    const memberships = (selection as Readonly<Record<string, unknown>>).memberships;
    if (!Array.isArray(memberships)) throw new Error('LOCAL_EMPLOYEE_MEMBERSHIPS_INVALID');
    const storefront = memberships.find((item): item is Readonly<{ id: string; client: string }> => item !== null && typeof item === 'object'
      && !Array.isArray(item) && typeof (item as Readonly<Record<string, unknown>>).id === 'string'
      && (item as Readonly<Record<string, unknown>>).client === 'storefront');
    operatorMembership = memberships.find((item): item is Readonly<{ id: string; client: string }> => item !== null && typeof item === 'object'
      && !Array.isArray(item) && typeof (item as Readonly<Record<string, unknown>>).id === 'string'
      && (item as Readonly<Record<string, unknown>>).client === 'console')?.id;
    if (!storefront) throw new Error('LOCAL_EMPLOYEE_STOREFRONT_MEMBERSHIP_MISSING');
    login = await authenticate(storefront.id);
  }
  if (login.status !== 201) throw new Error(`LOCAL_EMPLOYEE_LOGIN_HTTP_${login.status}:${await login.text()}`);
  const cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
  if (!cookie) throw new Error('LOCAL_EMPLOYEE_SESSION_COOKIE_MISSING');
  const session = await localFetch('http://127.0.0.1:3001/api/v1/identity/session', { headers: {
    cookie,
    'x-client-version': '0.0.0',
    'x-contract-version': CONTRACT_VERSION,
    'x-request-id': randomUUID(),
  } });
  if (session.status !== 200) throw new Error(`LOCAL_EMPLOYEE_SESSION_HTTP_${session.status}:${await session.text()}`);
  const payload: unknown = await session.json();
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const permissions = (payload as Readonly<Record<string, unknown>>).permissions;
  if (!Array.isArray(permissions)) throw new Error('LOCAL_EMPLOYEE_SESSION_PERMISSIONS_INVALID');
  const required = ['catalog.listing.read', 'pricing.offer.read', 'inventory.read', 'cart.read', 'cart.manage', 'checkout.create',
    'order.create', 'order.read', 'order.aftersale.apply', 'payment.create', 'benefit.read', 'voucher.binding.read', 'support.case.create',
    'observability.clienterror.create'];
  const missing = required.filter((permission) => !permissions.includes(permission));
  if (missing.length > 0) throw new Error(`LOCAL_EMPLOYEE_SESSION_PERMISSIONS_MISSING:${missing.join(',')}`);
  const bearer = cookie.slice(cookie.indexOf('=') + 1);
  const report = await localFetch('http://127.0.0.1:3001/api/v1/telemetry/clienterrors', { method:'POST', headers:{
    authorization:`Bearer ${bearer}`, 'content-type':'application/json', 'idempotency-key':randomUUID(),
    'x-client-version':'0.0.0', 'x-contract-version':CONTRACT_VERSION, 'x-request-id':randomUUID(),
  }, body:JSON.stringify({ surface:'storefront', route:'/local/verify', message:'local telemetry verification', stack:null, componentStack:null }) });
  if (report.status !== 202) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const reported: unknown = await report.json();
  const faultCode = reported !== null && typeof reported === 'object' && !Array.isArray(reported)
    ? (reported as Readonly<Record<string, unknown>>).faultCode : null;
  if (typeof faultCode !== 'string' || operatorMembership === undefined) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const operatorLogin = await authenticate(operatorMembership);
  const operatorCookie = operatorLogin.headers.get('set-cookie')?.split(';', 1)[0];
  if (operatorLogin.status !== 201 || !operatorCookie) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const operatorBearer = operatorCookie.slice(operatorCookie.indexOf('=') + 1);
  const ownerScope = await localOwnerScope(connectionString);
  const errors = await localFetch('http://127.0.0.1:3001/api/v1/telemetry/clienterrors?limit=20', { headers:{ authorization:`Bearer ${operatorBearer}`,
    'x-client-version':'0.0.0', 'x-contract-version':CONTRACT_VERSION, 'x-request-id':randomUUID() } });
  if (errors.status !== 200 || !(await errors.text()).includes(faultCode)) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const storeId = `store:local-${randomUUID()}`;
  const storeName = `本地门店-${storeId.slice(-12)}`;
  const saveStore = (body: unknown, etag?: string) => localFetch(`http://127.0.0.1:3001/api/v1/organizations/stores/${encodeURIComponent(storeId)}`, {
    method:'PUT', headers:{ authorization:`Bearer ${operatorBearer}`, 'content-type':'application/json', 'idempotency-key':randomUUID(),
      ...(etag === undefined ? {} : { 'if-match':etag }), 'x-client-version':'0.0.0', 'x-contract-version':CONTRACT_VERSION, 'x-request-id':randomUUID() },
    body:JSON.stringify(body),
  });
  const createdStore = await saveStore({ name:storeName, status:'active', mall:ownerScope.mall, regionCode:'310000',
    serviceRadiusMeters:3000, address:'上海市测试路88号' });
  const storeEtag = createdStore.headers.get('etag');
  const storePayload: unknown = await createdStore.json();
  if (createdStore.status !== 200 || storeEtag === null || storePayload === null || typeof storePayload !== 'object' || Array.isArray(storePayload)
    || (storePayload as Readonly<Record<string, unknown>>).addressConfigured !== true) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  await verifyEncryptedStore(connectionString, storeId, '上海市测试路88号');
  const stores = await localFetch('http://127.0.0.1:3001/api/v1/organizations/stores?limit=100', { headers:{ authorization:`Bearer ${operatorBearer}`,
    'x-client-version':'0.0.0', 'x-contract-version':CONTRACT_VERSION, 'x-request-id':randomUUID() } });
  if (stores.status !== 200 || !(await stores.text()).includes(storeId)) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const updatedStore = await saveStore({ name:storeName, status:'suspended', mall:ownerScope.mall, regionCode:'310000',
    serviceRadiusMeters:5000, address:null }, storeEtag);
  const updatedStorePayload: unknown = await updatedStore.json();
  if (updatedStore.status !== 200 || updatedStorePayload === null || typeof updatedStorePayload !== 'object' || Array.isArray(updatedStorePayload)
    || (updatedStorePayload as Readonly<Record<string, unknown>>).addressConfigured !== false
    || Number((updatedStorePayload as Readonly<Record<string, unknown>>).version) !== 1) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const staleStore = await saveStore({ name:'过期版本不应生效', status:'active', mall:ownerScope.mall, regionCode:'310000',
    serviceRadiusMeters:5000, address:null }, storeEtag);
  if (staleStore.status !== 409) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const invitation = await localFetch('http://127.0.0.1:3001/api/v1/identity/invitations', { method:'POST', headers:{
    authorization:`Bearer ${operatorBearer}`, 'content-type':'application/json', 'idempotency-key':randomUUID(),
    'x-client-version':'0.0.0', 'x-contract-version':CONTRACT_VERSION, 'x-request-id':randomUUID(),
    'x-scope-hint':ownerScope.tenant,
  }, body:JSON.stringify({ label:'本地邀请验证', targetClient:'operator', destination:'13800138001', maxUses:1,
    storefrontOrganization:ownerScope.mall, expiresAt:new Date(Date.now()+24*60*60_000).toISOString() }) });
  if (invitation.status !== 201) throw new Error(`LOCAL_INVITATION_CREATE_HTTP_${invitation.status}`);
  const invitationEtag = invitation.headers.get('etag');
  const created: unknown = await invitation.json();
  if (created === null || typeof created !== 'object' || Array.isArray(created)) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const invitationId = (created as Readonly<Record<string, unknown>>).id;
  const invitationCode = (created as Readonly<Record<string, unknown>>).code;
  const invitationTarget = (created as Readonly<Record<string, unknown>>).target;
  const invitationVersion = (created as Readonly<Record<string, unknown>>).version;
  if (typeof invitationId !== 'string' || typeof invitationCode !== 'string' || invitationTarget !== 'console' || invitationEtag === null
    || !['number','string'].includes(typeof invitationVersion)) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  await verifyInvitationToken(connectionString, invitationId, invitationCode, identityKey);
  const resolveInvitation = () => localFetch('http://127.0.0.1:3001/api/v1/identity/invitations/resolve', { method:'POST', headers:{
    'content-type':'application/json', 'idempotency-key':randomUUID(), origin:'http://127.0.0.1:3000', 'x-client-version':'0.0.0',
    'x-contract-version':CONTRACT_VERSION, 'x-request-id':randomUUID(),
  }, body:JSON.stringify({ invite:invitationCode }) });
  if ((await resolveInvitation()).status !== 200) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const revoke = await localFetch(`http://127.0.0.1:3001/api/v1/identity/invitations/${encodeURIComponent(invitationId)}`, { method:'DELETE', headers:{
    authorization:`Bearer ${operatorBearer}`, 'content-type':'application/json', 'idempotency-key':randomUUID(), 'if-match':invitationEtag,
    'x-client-version':'0.0.0', 'x-contract-version':CONTRACT_VERSION, 'x-request-id':randomUUID(),
  }, body:JSON.stringify({ reason:'本地验证完成后撤销' }) });
  if (revoke.status !== 200 || (await resolveInvitation()).status !== 404) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const ledger = await localFetch('http://127.0.0.1:3001/api/v1/benefits/ledgers', { headers:{ authorization:`Bearer ${bearer}`,
    'x-client-version':'0.0.0', 'x-contract-version':CONTRACT_VERSION, 'x-request-id':randomUUID() } });
  const ledgerPayload: unknown = await ledger.json();
  if (ledger.status !== 200 || ledgerPayload === null || typeof ledgerPayload !== 'object' || Array.isArray(ledgerPayload)
    || !Array.isArray((ledgerPayload as Readonly<Record<string, unknown>>).items)) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const listSessions = () => localFetch('http://127.0.0.1:3001/api/v1/identity/sessions', { headers:{ authorization:`Bearer ${bearer}`,
    'x-client-version':'0.0.0', 'x-contract-version':CONTRACT_VERSION, 'x-request-id':randomUUID() } });
  const sessions = await listSessions();
  const sessionPayload: unknown = await sessions.json();
  const sessionItems = sessionPayload !== null && typeof sessionPayload === 'object' && !Array.isArray(sessionPayload)
    ? (sessionPayload as Readonly<Record<string, unknown>>).items : null;
  if (sessions.status !== 200 || !Array.isArray(sessionItems) || sessionItems.length < 2
    || sessionItems.filter((item) => item !== null && typeof item === 'object' && !Array.isArray(item)
      && (item as Readonly<Record<string, unknown>>).current === true).length !== 1) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const revokeOthers = await localFetch('http://127.0.0.1:3001/api/v1/identity/sessions/others', { method:'DELETE', headers:{
    authorization:`Bearer ${bearer}`, 'idempotency-key':randomUUID(), 'x-client-version':'0.0.0',
    'x-contract-version':CONTRACT_VERSION, 'x-request-id':randomUUID() } });
  const revoked: unknown = await revokeOthers.json();
  if (revokeOthers.status !== 200 || revoked === null || typeof revoked !== 'object' || Array.isArray(revoked)
    || typeof (revoked as Readonly<Record<string, unknown>>).revoked !== 'number'
    || Number((revoked as Readonly<Record<string, unknown>>).revoked) < 1) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
  const remaining = await listSessions();
  const remainingPayload: unknown = await remaining.json();
  const remainingItems = remainingPayload !== null && typeof remainingPayload === 'object' && !Array.isArray(remainingPayload)
    ? (remainingPayload as Readonly<Record<string, unknown>>).items : null;
  if (remaining.status !== 200 || !Array.isArray(remainingItems) || remainingItems.length !== 1) throw new Error('LOCAL_EMPLOYEE_SESSION_INVALID');
}
