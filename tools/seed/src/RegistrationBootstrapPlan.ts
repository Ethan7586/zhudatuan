import { createHash, createHmac, randomBytes } from 'node:crypto';
import { isAbsolute, normalize } from 'node:path';
import { bearerToken } from '@shop/config/server';

export const REGISTRATION_BASELINE_VERSION = '20260828170000';
export const REGISTRATION_POLICY_ID = 'registration:zhudatuan:2026-08-28-v1';
export const REGISTRATION_TERMS_HASH = '207450deff7c7baece6af24957ff48adf3393532a5d37b6f8d369370253e557d';
export const REGISTRATION_ORGANIZATION_ID = 'mall-zhudatuan';
export const REGISTRATION_ROLE_ID = 'role-zhudatuan-storefront-member';
export const REGISTRATION_INVITATION_ID = 'invite:zhudatuan:registration-test:v1';
export const REGISTRATION_BOOTSTRAP_CONFIRMATION = 'INDEPENDENT_TEST_DB_ONLY';

const DOCUMENT_SCHEMA = 'zhudatuan.registration-invitation-export.v1';
const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const DATABASE_NAME_PATTERN = /^[a-z][a-z0-9_-]{2,62}$/;
const ACTOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{2,127}$/;
const REGISTRATION_DATABASE = 'zhudatuan_registration';
const REGISTRATION_DATABASE_HOST = '127.0.0.1';
const REGISTRATION_DATABASE_PORT = '55432';
const REGISTRATION_BOOTSTRAP_DATABASE_ROLE = 'zhudatuanbootstrap';
const SENTINEL_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

export interface RegistrationBootstrapEnvironment {
  readonly connectionString: string;
  readonly expectedDatabase: string;
  readonly outputPath: string;
  readonly actor: string;
  readonly expiresInHours: number;
  readonly sentinel: string;
  readonly identityKeyRef: string;
  readonly secretStoreEndpoint: string;
  readonly secretStoreBearerToken: string;
}

export interface RegistrationInvitationExport {
  readonly schema: typeof DOCUMENT_SCHEMA;
  readonly invitationId: typeof REGISTRATION_INVITATION_ID;
  readonly invitationCode: string;
  readonly tokenHash: string;
  readonly organizationId: typeof REGISTRATION_ORGANIZATION_ID;
  readonly policyId: typeof REGISTRATION_POLICY_ID;
  readonly termsHash: typeof REGISTRATION_TERMS_HASH;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly maxUses: 1;
}

export interface ExistingInvitation {
  readonly id: string;
  readonly organization_id: string;
  readonly label: string;
  readonly destination_hash: string;
  readonly token_hash: string;
  readonly expires_at: string | Date;
  readonly created_by: string;
  readonly role_id: string;
  readonly allowed_destination_hash: string | null;
  readonly max_uses: number;
  readonly use_count: number;
  readonly effective_at: string | Date;
  readonly status: string;
  readonly created_at: string | Date;
  readonly registration_policy_id: string;
  readonly terms_hash: string;
}

export function registrationBootstrapEnvironment(source: NodeJS.ProcessEnv): RegistrationBootstrapEnvironment {
  if (source.APP_ENV !== 'test') throw new Error('REGISTRATION_BOOTSTRAP_TEST_ENV_REQUIRED');
  if (source.ZHUDATUAN_REGISTRATION_BOOTSTRAP_CONFIRM !== REGISTRATION_BOOTSTRAP_CONFIRMATION) {
    throw new Error('REGISTRATION_BOOTSTRAP_CONFIRMATION_REQUIRED');
  }
  const connectionString = required(source.ZHUDATUAN_REGISTRATION_BOOTSTRAP_DATABASE_URL, 'REGISTRATION_BOOTSTRAP_DATABASE_URL_REQUIRED');
  const databaseUrl = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) || databaseUrl.hash) {
    throw new Error('REGISTRATION_BOOTSTRAP_DATABASE_URL_INVALID');
  }
  const expectedDatabase = required(source.ZHUDATUAN_REGISTRATION_BOOTSTRAP_DATABASE_NAME, 'REGISTRATION_BOOTSTRAP_DATABASE_NAME_REQUIRED');
  if (!DATABASE_NAME_PATTERN.test(expectedDatabase) || expectedDatabase !== REGISTRATION_DATABASE
    || decodeURIComponent(databaseUrl.pathname.slice(1)) !== expectedDatabase) {
    throw new Error('REGISTRATION_BOOTSTRAP_DATABASE_NAME_MISMATCH');
  }
  if (databaseUrl.hostname !== REGISTRATION_DATABASE_HOST || databaseUrl.port !== REGISTRATION_DATABASE_PORT
    || decodeURIComponent(databaseUrl.username) !== REGISTRATION_BOOTSTRAP_DATABASE_ROLE) {
    throw new Error('REGISTRATION_BOOTSTRAP_DATABASE_ENDPOINT_INVALID');
  }
  const outputPath = normalize(required(source.ZHUDATUAN_REGISTRATION_BOOTSTRAP_OUTPUT, 'REGISTRATION_BOOTSTRAP_OUTPUT_REQUIRED'));
  if (!isAbsolute(outputPath) || !outputPath.endsWith('.json')) throw new Error('REGISTRATION_BOOTSTRAP_OUTPUT_INVALID');
  const actor = source.ZHUDATUAN_REGISTRATION_BOOTSTRAP_ACTOR?.trim() || 'owner:Ethan';
  if (!ACTOR_PATTERN.test(actor)) throw new Error('REGISTRATION_BOOTSTRAP_ACTOR_INVALID');
  const expiresInHours = Number(source.ZHUDATUAN_REGISTRATION_BOOTSTRAP_EXPIRES_HOURS ?? '24');
  if (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 168) {
    throw new Error('REGISTRATION_BOOTSTRAP_EXPIRY_INVALID');
  }
  const sentinel = required(source.ZHUDATUAN_REGISTRATION_BOOTSTRAP_SENTINEL, 'REGISTRATION_BOOTSTRAP_SENTINEL_REQUIRED');
  if (!SENTINEL_PATTERN.test(sentinel)) throw new Error('REGISTRATION_BOOTSTRAP_SENTINEL_INVALID');
  const identityKeyRef = required(source.IDENTITY_KEY_REF, 'REGISTRATION_BOOTSTRAP_IDENTITY_KEY_REF_REQUIRED');
  if (!/^[a-z0-9][a-z0-9/._-]{2,255}$/.test(identityKeyRef)) throw new Error('REGISTRATION_BOOTSTRAP_IDENTITY_KEY_REF_INVALID');
  const secretStoreEndpoint = secureLoopbackEndpoint(source.SECRET_STORE_ENDPOINT);
  const secretStoreBearerToken = bearerToken(source.SECRET_STORE_BEARER_TOKEN,
    'REGISTRATION_BOOTSTRAP_SECRET_STORE_BEARER_TOKEN_INVALID');
  return Object.freeze({ connectionString, expectedDatabase, outputPath, actor, expiresInHours, sentinel,
    identityKeyRef, secretStoreEndpoint, secretStoreBearerToken });
}

export function createRegistrationInvitationExport(now: Date, expiresInHours: number, identityKey: string): RegistrationInvitationExport {
  if (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 168 || Number.isNaN(now.getTime())) {
    throw new Error('REGISTRATION_BOOTSTRAP_EXPORT_INPUT_INVALID');
  }
  if (identityKey.length < 32) throw new Error('REGISTRATION_BOOTSTRAP_IDENTITY_KEY_INVALID');
  const invitationCode = randomBytes(32).toString('base64url');
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + expiresInHours * 3_600_000).toISOString();
  return Object.freeze({
    schema: DOCUMENT_SCHEMA,
    invitationId: REGISTRATION_INVITATION_ID,
    invitationCode,
    tokenHash: registrationInvitationTokenHash(invitationCode, identityKey),
    organizationId: REGISTRATION_ORGANIZATION_ID,
    policyId: REGISTRATION_POLICY_ID,
    termsHash: REGISTRATION_TERMS_HASH,
    createdAt,
    expiresAt,
    maxUses: 1,
  });
}

export function parseRegistrationInvitationExport(serialized: string, identityKey: string): RegistrationInvitationExport {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error('REGISTRATION_BOOTSTRAP_EXPORT_JSON_INVALID');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('REGISTRATION_BOOTSTRAP_EXPORT_INVALID');
  const record = value as Readonly<Record<string, unknown>>;
  const expectedKeys = ['createdAt', 'expiresAt', 'invitationCode', 'invitationId', 'maxUses', 'organizationId', 'policyId', 'schema', 'termsHash', 'tokenHash'];
  if (JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(expectedKeys)) throw new Error('REGISTRATION_BOOTSTRAP_EXPORT_FIELDS_INVALID');
  if (
    record.schema !== DOCUMENT_SCHEMA ||
    record.invitationId !== REGISTRATION_INVITATION_ID ||
    record.organizationId !== REGISTRATION_ORGANIZATION_ID ||
    record.policyId !== REGISTRATION_POLICY_ID ||
    record.termsHash !== REGISTRATION_TERMS_HASH ||
    record.maxUses !== 1 ||
    typeof record.invitationCode !== 'string' ||
    !CODE_PATTERN.test(record.invitationCode) ||
    typeof record.tokenHash !== 'string' ||
    !HASH_PATTERN.test(record.tokenHash) ||
    record.tokenHash !== registrationInvitationTokenHash(record.invitationCode, identityKey) ||
    typeof record.createdAt !== 'string' ||
    typeof record.expiresAt !== 'string'
  ) {
    throw new Error('REGISTRATION_BOOTSTRAP_EXPORT_INVALID');
  }
  const created = new Date(record.createdAt);
  const expires = new Date(record.expiresAt);
  if (Number.isNaN(created.getTime()) || Number.isNaN(expires.getTime()) || expires <= created || expires.getTime() - created.getTime() > 168 * 3_600_000) {
    throw new Error('REGISTRATION_BOOTSTRAP_EXPORT_TIME_INVALID');
  }
  return Object.freeze(record as unknown as RegistrationInvitationExport);
}

export function assertExistingInvitation(existing: ExistingInvitation, exported: RegistrationInvitationExport, actor: string): void {
  if (
    existing.id !== REGISTRATION_INVITATION_ID ||
    existing.organization_id !== REGISTRATION_ORGANIZATION_ID ||
    existing.label !== '主打团测试注册（一次）' ||
    existing.destination_hash !== sha256(REGISTRATION_INVITATION_ID) ||
    existing.token_hash !== exported.tokenHash ||
    existing.created_by !== actor ||
    existing.role_id !== REGISTRATION_ROLE_ID ||
    existing.allowed_destination_hash !== null ||
    Number(existing.max_uses) !== 1 ||
    Number(existing.use_count) !== 0 ||
    existing.status !== 'active' ||
    existing.registration_policy_id !== REGISTRATION_POLICY_ID ||
    existing.terms_hash !== REGISTRATION_TERMS_HASH ||
    iso(existing.created_at) !== exported.createdAt ||
    iso(existing.effective_at) !== exported.createdAt ||
    iso(existing.expires_at) !== exported.expiresAt
  ) {
    throw new Error('REGISTRATION_BOOTSTRAP_INVITATION_CONFLICT');
  }
  if (new Date(existing.expires_at).getTime() <= Date.now()) throw new Error('REGISTRATION_BOOTSTRAP_INVITATION_EXPIRED');
}

export function assertRegistrationInvitationExportUsable(exported: RegistrationInvitationExport, now = new Date()): void {
  if (Number.isNaN(now.getTime()) || new Date(exported.expiresAt).getTime() <= now.getTime()) {
    throw new Error('REGISTRATION_BOOTSTRAP_EXPORT_EXPIRED');
  }
}

export function bootstrapSummary(exported: RegistrationInvitationExport, outputPath: string, state: 'created' | 'existing'): string {
  return `ZHUDATUAN_REGISTRATION_BOOTSTRAP_READY state=${state} invitation=${exported.invitationId} organization=${exported.organizationId} expires=${exported.expiresAt} fingerprint=${exported.tokenHash.slice(0, 16)} export=${outputPath}`;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function registrationInvitationTokenHash(invitationCode: string, identityKey: string): string {
  if (!CODE_PATTERN.test(invitationCode) || identityKey.length < 32) throw new Error('REGISTRATION_BOOTSTRAP_IDENTITY_KEY_INVALID');
  return createHmac('sha256', identityKey).update(invitationCode.trim().toLowerCase()).digest('hex');
}

function secureLoopbackEndpoint(value: string | undefined): string {
  let endpoint: URL;
  try { endpoint = new URL(required(value, 'REGISTRATION_BOOTSTRAP_SECRET_STORE_ENDPOINT_REQUIRED')); }
  catch { throw new Error('REGISTRATION_BOOTSTRAP_SECRET_STORE_ENDPOINT_INVALID'); }
  if (endpoint.protocol!=='https:' || endpoint.hostname!=='127.0.0.1' || endpoint.port!=='8543'
    || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('REGISTRATION_BOOTSTRAP_SECRET_STORE_ENDPOINT_INVALID');
  }
  return endpoint.origin;
}

function iso(value: string | Date): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('REGISTRATION_BOOTSTRAP_INVITATION_TIME_INVALID');
  return parsed.toISOString();
}

function required(value: string | undefined, code: string): string {
  const result = value?.trim();
  if (!result) throw new Error(code);
  return result;
}
