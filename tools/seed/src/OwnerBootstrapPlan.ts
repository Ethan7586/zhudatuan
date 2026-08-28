import { createHmac } from 'node:crypto';
import { bearerToken } from '@shop/config/server';

export const OWNER_BOOTSTRAP_CONFIRMATION = 'CREATE_ONE_ZHUDATUAN_CONSOLE_OWNER_ETHAN';
export const OWNER_PRINCIPAL_ID = 'principal:zhudatuan:owner:ethan:v1';
export const OWNER_CREDENTIAL_ID = 'credential:password:zhudatuan-owner-ethan:v1';
export const OWNER_MEMBER_ID = 'member:zhudatuan:owner:ethan:v1';
export const OWNER_MEMBERSHIP_ID = 'membership-platform-owner-ethan-v1';
export const OWNER_SUBJECT = 'ethan';
export const OWNER_DISPLAY_NAME = 'Ethan';
export const OWNER_PLATFORM_SCOPE_ID = 'organization-platform-root';
export const OWNER_TENANT_SCOPE_ID = 'tenant-zhudatuan';
export const OWNER_ROLE_ID = 'role-platform-owner-v2';
export const OWNER_SELF_ROLE_ID = 'role:self';

const OWNER_DATABASE = 'zhudatuan_registration';
const OWNER_DATABASE_ROLE = 'zhudatuanbootstrap';
const OWNER_DATABASE_HOST = '127.0.0.1';
const OWNER_DATABASE_PORT = '55432';
const REFERENCE_PATTERN = /^[a-z0-9][a-z0-9/._-]{2,255}$/;
const SENTINEL_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const ACTOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{2,127}$/;

export interface OwnerBootstrapEnvironment {
  readonly connectionString: string;
  readonly expectedDatabase: typeof OWNER_DATABASE;
  readonly sentinel: string;
  readonly actor: string;
  readonly identityKeyRef: string;
  readonly passwordRef: string;
  readonly secretStoreEndpoint: 'https://127.0.0.1:8543';
  readonly secretStoreBearerToken: string;
}

export function ownerBootstrapEnvironment(source: NodeJS.ProcessEnv): OwnerBootstrapEnvironment {
  if (source.APP_ENV !== 'production') throw new Error('OWNER_BOOTSTRAP_PRODUCTION_ENV_REQUIRED');
  if (source.ZHUDATUAN_OWNER_BOOTSTRAP_CONFIRM !== OWNER_BOOTSTRAP_CONFIRMATION) {
    throw new Error('OWNER_BOOTSTRAP_CONFIRMATION_REQUIRED');
  }
  const connectionString = required(source.ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL, 'OWNER_BOOTSTRAP_DATABASE_URL_REQUIRED');
  let databaseUrl: URL;
  try { databaseUrl = new URL(connectionString); }
  catch { throw new Error('OWNER_BOOTSTRAP_DATABASE_URL_INVALID'); }
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) || databaseUrl.hash || databaseUrl.search
    || databaseUrl.hostname !== OWNER_DATABASE_HOST || databaseUrl.port !== OWNER_DATABASE_PORT
    || decodeURIComponent(databaseUrl.pathname.slice(1)) !== OWNER_DATABASE
    || decodeURIComponent(databaseUrl.username) !== OWNER_DATABASE_ROLE || databaseUrl.password.length < 16) {
    throw new Error('OWNER_BOOTSTRAP_DATABASE_ENDPOINT_INVALID');
  }
  const expectedDatabase = required(source.ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_NAME, 'OWNER_BOOTSTRAP_DATABASE_NAME_REQUIRED');
  if (expectedDatabase !== OWNER_DATABASE) throw new Error('OWNER_BOOTSTRAP_DATABASE_NAME_MISMATCH');
  const sentinel = required(source.ZHUDATUAN_OWNER_BOOTSTRAP_SENTINEL, 'OWNER_BOOTSTRAP_SENTINEL_REQUIRED');
  if (!SENTINEL_PATTERN.test(sentinel)) throw new Error('OWNER_BOOTSTRAP_SENTINEL_INVALID');
  const actor = source.ZHUDATUAN_OWNER_BOOTSTRAP_ACTOR?.trim() || 'owner:Ethan';
  if (!ACTOR_PATTERN.test(actor)) throw new Error('OWNER_BOOTSTRAP_ACTOR_INVALID');
  const identityKeyRef = secretReference(source.IDENTITY_KEY_REF, 'OWNER_BOOTSTRAP_IDENTITY_KEY_REF_REQUIRED');
  const passwordRef = secretReference(source.ZHUDATUAN_OWNER_PASSWORD_REF, 'OWNER_BOOTSTRAP_PASSWORD_REF_REQUIRED');
  if (identityKeyRef === passwordRef) throw new Error('OWNER_BOOTSTRAP_SECRET_REFERENCES_MUST_DIFFER');
  const secretStoreEndpoint = secureSecretStoreEndpoint(source.SECRET_STORE_ENDPOINT);
  const secretStoreBearerToken = bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'OWNER_BOOTSTRAP_SECRET_STORE_TOKEN_INVALID');
  return Object.freeze({ connectionString, expectedDatabase: OWNER_DATABASE, sentinel, actor, identityKeyRef,
    passwordRef, secretStoreEndpoint, secretStoreBearerToken });
}

export function ownerSubjectHash(identityKey: string): string {
  return keyedFingerprint(identityKey, OWNER_SUBJECT);
}

export function ownerPasswordFingerprint(identityKey: string, password: string): string {
  if (password.length < 12 || password.length > 128) throw new Error('OWNER_BOOTSTRAP_PASSWORD_INVALID');
  return keyedFingerprint(identityKey, `owner-password:${password}`);
}

export function ownerBootstrapSummary(state: 'created' | 'existing'): string {
  return `ZHUDATUAN_OWNER_BOOTSTRAP_READY state=${state} principal=${OWNER_PRINCIPAL_ID} membership=${OWNER_MEMBERSHIP_ID} target=console`;
}

function keyedFingerprint(key: string, value: string): string {
  if (key.length < 32) throw new Error('OWNER_BOOTSTRAP_IDENTITY_KEY_INVALID');
  return createHmac('sha256', key).update(value.trim().toLowerCase()).digest('hex');
}

function secretReference(value: string | undefined, code: string): string {
  const reference = required(value, code);
  if (!REFERENCE_PATTERN.test(reference)) throw new Error(`${code.replace('_REQUIRED', '')}_INVALID`);
  return reference;
}

function secureSecretStoreEndpoint(value: string | undefined): 'https://127.0.0.1:8543' {
  let endpoint: URL;
  try { endpoint = new URL(required(value, 'OWNER_BOOTSTRAP_SECRET_STORE_ENDPOINT_REQUIRED')); }
  catch { throw new Error('OWNER_BOOTSTRAP_SECRET_STORE_ENDPOINT_INVALID'); }
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== '127.0.0.1' || endpoint.port !== '8543'
    || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
    throw new Error('OWNER_BOOTSTRAP_SECRET_STORE_ENDPOINT_INVALID');
  }
  return 'https://127.0.0.1:8543';
}

function required(value: string | undefined, code: string): string {
  const result = value?.trim();
  if (!result) throw new Error(code);
  return result;
}
