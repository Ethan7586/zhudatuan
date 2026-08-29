import { createHmac } from 'node:crypto';
import { bearerToken } from '@shop/config/server';
import {
  OWNER_MEMBERSHIP_ID,
  OWNER_PRINCIPAL_ID,
  OWNER_SUBJECT,
} from './OwnerBootstrapPlan';

export const STAGING_OWNER_BOOTSTRAP_CONFIRMATION = 'CREATE_ONE_ZHUDATUAN_STAGING_CONSOLE_OWNER_ETHAN';

const STAGING_DATABASE = 'zhudatuan_registration';
const STAGING_DATABASE_ROLE = 'zhudatuanbootstrap';
const STAGING_DATABASE_HOST = '127.0.0.1';
const STAGING_DATABASE_PORT = '55442';
const STAGING_REFERENCE_PATTERN = /^zhudatuan\/staging\/[a-z0-9][a-z0-9/._-]{2,230}$/;
const STAGING_SENTINEL_PATTERN = /^staging_[A-Za-z0-9_-]{35,120}$/;
const ACTOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{2,127}$/;

export interface StagingOwnerBootstrapEnvironment {
  readonly connectionString: string;
  readonly expectedDatabase: typeof STAGING_DATABASE;
  readonly sentinel: string;
  readonly actor: string;
  readonly identityKeyRef: string;
  readonly passwordRef: string;
  readonly bootstrapReceiptRef: string;
  readonly secretStoreEndpoint: 'https://127.0.0.1:8643';
  readonly secretStoreBearerToken: string;
}

export function stagingOwnerBootstrapEnvironment(source: NodeJS.ProcessEnv): StagingOwnerBootstrapEnvironment {
  if (source.APP_ENV !== 'staging') throw new Error('STAGING_OWNER_BOOTSTRAP_STAGING_ENV_REQUIRED');
  if (source.ZHUDATUAN_OWNER_BOOTSTRAP_CONFIRM !== STAGING_OWNER_BOOTSTRAP_CONFIRMATION) {
    throw new Error('STAGING_OWNER_BOOTSTRAP_CONFIRMATION_REQUIRED');
  }
  const connectionString = required(source.ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL, 'STAGING_OWNER_BOOTSTRAP_DATABASE_URL_REQUIRED');
  let databaseUrl: URL;
  try { databaseUrl = new URL(connectionString); }
  catch { throw new Error('STAGING_OWNER_BOOTSTRAP_DATABASE_URL_INVALID'); }
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) || databaseUrl.hash
    || databaseUrl.searchParams.size !== 1 || databaseUrl.searchParams.get('sslmode') !== 'disable'
    || databaseUrl.hostname !== STAGING_DATABASE_HOST || databaseUrl.port !== STAGING_DATABASE_PORT
    || decodeURIComponent(databaseUrl.pathname.slice(1)) !== STAGING_DATABASE
    || decodeURIComponent(databaseUrl.username) !== STAGING_DATABASE_ROLE || databaseUrl.password.length < 16) {
    throw new Error('STAGING_OWNER_BOOTSTRAP_DATABASE_ENDPOINT_INVALID');
  }
  const expectedDatabase = required(source.ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_NAME, 'STAGING_OWNER_BOOTSTRAP_DATABASE_NAME_REQUIRED');
  if (expectedDatabase !== STAGING_DATABASE) throw new Error('STAGING_OWNER_BOOTSTRAP_DATABASE_NAME_MISMATCH');
  const sentinel = required(source.ZHUDATUAN_OWNER_BOOTSTRAP_SENTINEL, 'STAGING_OWNER_BOOTSTRAP_SENTINEL_REQUIRED');
  if (!STAGING_SENTINEL_PATTERN.test(sentinel)) throw new Error('STAGING_OWNER_BOOTSTRAP_SENTINEL_INVALID');
  const actor = source.ZHUDATUAN_OWNER_BOOTSTRAP_ACTOR?.trim() || 'owner:staging:Ethan';
  if (!ACTOR_PATTERN.test(actor)) throw new Error('STAGING_OWNER_BOOTSTRAP_ACTOR_INVALID');
  const identityKeyRef = stagingSecretReference(source.IDENTITY_KEY_REF, 'STAGING_OWNER_BOOTSTRAP_IDENTITY_KEY_REF_REQUIRED');
  const passwordRef = stagingSecretReference(source.ZHUDATUAN_OWNER_PASSWORD_REF, 'STAGING_OWNER_BOOTSTRAP_PASSWORD_REF_REQUIRED');
  const bootstrapReceiptRef = stagingSecretReference(source.ZHUDATUAN_OWNER_BOOTSTRAP_RECEIPT_REF,
    'STAGING_OWNER_BOOTSTRAP_RECEIPT_REF_REQUIRED');
  if (new Set([identityKeyRef, passwordRef, bootstrapReceiptRef]).size !== 3) {
    throw new Error('STAGING_OWNER_BOOTSTRAP_SECRET_REFERENCES_MUST_DIFFER');
  }
  const secretStoreEndpoint = secureSecretStoreEndpoint(source.SECRET_STORE_ENDPOINT);
  const secretStoreBearerToken = bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'STAGING_OWNER_BOOTSTRAP_SECRET_STORE_TOKEN_INVALID');
  return Object.freeze({ connectionString, expectedDatabase: STAGING_DATABASE, sentinel, actor, identityKeyRef,
    passwordRef, bootstrapReceiptRef, secretStoreEndpoint, secretStoreBearerToken });
}

export function stagingOwnerSubjectHash(identityKey: string): string {
  return keyedFingerprint(identityKey, OWNER_SUBJECT);
}

export function stagingOwnerBootstrapReceiptFingerprint(identityKey: string, receipt: string): string {
  if (receipt.length < 32 || receipt.length > 512) throw new Error('STAGING_OWNER_BOOTSTRAP_RECEIPT_INVALID');
  if (identityKey.length < 32) throw new Error('STAGING_OWNER_BOOTSTRAP_IDENTITY_KEY_INVALID');
  return createHmac('sha256', identityKey).update(`owner-bootstrap-receipt:${receipt}`).digest('hex');
}

export function stagingOwnerBootstrapSummary(state: 'created' | 'existing'): string {
  return `ZHUDATUAN_STAGING_OWNER_BOOTSTRAP_READY state=${state} principal=${OWNER_PRINCIPAL_ID} membership=${OWNER_MEMBERSHIP_ID} target=console`;
}

function keyedFingerprint(key: string, value: string): string {
  if (key.length < 32) throw new Error('STAGING_OWNER_BOOTSTRAP_IDENTITY_KEY_INVALID');
  return createHmac('sha256', key).update(value.trim().toLowerCase()).digest('hex');
}

function stagingSecretReference(value: string | undefined, code: string): string {
  const reference = required(value, code);
  if (!STAGING_REFERENCE_PATTERN.test(reference)) throw new Error(`${code.replace('_REQUIRED', '')}_INVALID`);
  return reference;
}

function secureSecretStoreEndpoint(value: string | undefined): 'https://127.0.0.1:8643' {
  let endpoint: URL;
  try { endpoint = new URL(required(value, 'STAGING_OWNER_BOOTSTRAP_SECRET_STORE_ENDPOINT_REQUIRED')); }
  catch { throw new Error('STAGING_OWNER_BOOTSTRAP_SECRET_STORE_ENDPOINT_INVALID'); }
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== '127.0.0.1' || endpoint.port !== '8643'
    || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
    throw new Error('STAGING_OWNER_BOOTSTRAP_SECRET_STORE_ENDPOINT_INVALID');
  }
  return 'https://127.0.0.1:8643';
}

function required(value: string | undefined, code: string): string {
  const result = value?.trim();
  if (!result) throw new Error(code);
  return result;
}
