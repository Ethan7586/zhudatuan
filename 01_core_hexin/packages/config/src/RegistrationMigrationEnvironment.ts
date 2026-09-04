import { bearerToken, distinctValues, enumValue, requiredValue, type EnvironmentSource } from './Environment';
import { MIGRATION_APPROVAL } from './Release';

export const REGISTRATION_MIGRATION_PROFILE = 'registration-only' as const;
export const REGISTRATION_MIGRATION_DIRECTORY = '/opt/zhudatuan/current/02_platform_pingtai/database/supabase/migrations' as const;
const IMMUTABLE_RELEASE_MIGRATION_DIRECTORY = /^\/opt\/zhudatuan\/releases\/[0-9a-f]{40}-[a-z0-9-]+\/database\/supabase\/migrations$/;

export interface RegistrationMigrationEnvironment {
  readonly approval: typeof MIGRATION_APPROVAL;
  readonly databaseConnectionRef: string;
  readonly directory: string;
  readonly distributorKeyRef: string;
  readonly identityKeyRef: string;
  readonly kmsEndpoint: string;
  readonly kmsBearerToken: string;
  readonly partnerKeyRef: string;
  readonly profile: typeof REGISTRATION_MIGRATION_PROFILE;
  readonly secretStoreEndpoint: string;
  readonly secretStoreBearerToken: string;
  readonly snapshotRef: string;
  readonly voucherKeyRef: string;
}

export const REGISTRATION_MIGRATION_ENVIRONMENT_KEYS = Object.freeze([
  'APP_ENV',
  'KMS_ENDPOINT',
  'KMS_BEARER_TOKEN',
  'MIGRATION_APPROVAL',
  'MIGRATION_DATABASE_CONNECTION_REF',
  'MIGRATION_DIRECTORY',
  'MIGRATION_DISTRIBUTOR_KEY_REF',
  'MIGRATION_IDENTITY_KEY_REF',
  'MIGRATION_PARTNER_KEY_REF',
  'MIGRATION_SOURCE_SNAPSHOT_REF',
  'MIGRATION_VOUCHER_KEY_REF',
  'REGISTRATION_MIGRATION_PROFILE',
  'SECRET_STORE_ENDPOINT',
  'SECRET_STORE_BEARER_TOKEN',
] as const);

const CONFIGURATION_KEY = /^(?:API_|APP_ENV$|AUTH_|DATABASE_|EXTENSION_|IDENTITY_|INVOICE_|JOB_|KMS_|MIGRATION_|NOTIFICATION_|OBJECT_|PAYMENT_|PAYOUT_|PII_|PUBLIC_|QUOTE_|REDIS_|REGISTRATION_|SECRET_|SESSION_|SERVICE_VERSION$|WECHAT_)/;
const ALLOWED_KEYS = new Set<string>(REGISTRATION_MIGRATION_ENVIRONMENT_KEYS);

export function registrationMigrationEnvironment(source: EnvironmentSource): RegistrationMigrationEnvironment {
  for (const key of Object.keys(source).filter((candidate) => CONFIGURATION_KEY.test(candidate) && !ALLOWED_KEYS.has(candidate)).sort()) {
    throw new Error(`REGISTRATION_MIGRATION_KEY_FORBIDDEN:${key}`);
  }
  if (source.APP_ENV !== 'production') throw new Error('REGISTRATION_MIGRATION_PRODUCTION_ENV_REQUIRED');
  const profile = enumValue(source.REGISTRATION_MIGRATION_PROFILE, [REGISTRATION_MIGRATION_PROFILE] as const,
    'REGISTRATION_MIGRATION_PROFILE_INVALID');
  const directory = requiredValue(source.MIGRATION_DIRECTORY, 'REGISTRATION_MIGRATION_DIRECTORY_MISSING');
  if (directory !== REGISTRATION_MIGRATION_DIRECTORY && !IMMUTABLE_RELEASE_MIGRATION_DIRECTORY.test(directory)) {
    throw new Error('REGISTRATION_MIGRATION_DIRECTORY_INVALID');
  }
  const kmsEndpoint = secureLoopbackEndpoint(source.KMS_ENDPOINT, 8544, 'REGISTRATION_MIGRATION_KMS_ENDPOINT_INVALID');
  const secretStoreEndpoint = secureLoopbackEndpoint(source.SECRET_STORE_ENDPOINT, 8543,
    'REGISTRATION_MIGRATION_SECRET_STORE_ENDPOINT_INVALID');
  const kmsBearerToken = bearerToken(source.KMS_BEARER_TOKEN, 'REGISTRATION_MIGRATION_KMS_BEARER_TOKEN_INVALID');
  const secretStoreBearerToken = bearerToken(source.SECRET_STORE_BEARER_TOKEN,
    'REGISTRATION_MIGRATION_SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kmsBearerToken, secretStoreBearerToken, 'REGISTRATION_MIGRATION_WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  const snapshotRef = requiredValue(source.MIGRATION_SOURCE_SNAPSHOT_REF, 'REGISTRATION_MIGRATION_SOURCE_SNAPSHOT_REF_MISSING');
  if (snapshotRef !== 'zhudatuan/registration/empty-database-v1') throw new Error('REGISTRATION_MIGRATION_SOURCE_SNAPSHOT_REF_INVALID');
  return Object.freeze({
    approval: enumValue(source.MIGRATION_APPROVAL, [MIGRATION_APPROVAL] as const, 'REGISTRATION_MIGRATION_APPROVAL_INVALID'),
    databaseConnectionRef: exactReference(source.MIGRATION_DATABASE_CONNECTION_REF,
      'zhudatuan/registration/database/migration', 'REGISTRATION_MIGRATION_DATABASE_CONNECTION_REF_INVALID'),
    directory,
    distributorKeyRef: exactReference(source.MIGRATION_DISTRIBUTOR_KEY_REF,
      'zhudatuan/migration/distributor', 'REGISTRATION_MIGRATION_DISTRIBUTOR_KEY_REF_INVALID'),
    identityKeyRef: exactReference(source.MIGRATION_IDENTITY_KEY_REF,
      'zhudatuan/migration/identity', 'REGISTRATION_MIGRATION_IDENTITY_KEY_REF_INVALID'),
    kmsEndpoint,
    kmsBearerToken,
    partnerKeyRef: exactReference(source.MIGRATION_PARTNER_KEY_REF,
      'zhudatuan/migration/partner', 'REGISTRATION_MIGRATION_PARTNER_KEY_REF_INVALID'),
    profile,
    secretStoreEndpoint,
    secretStoreBearerToken,
    snapshotRef,
    voucherKeyRef: exactReference(source.MIGRATION_VOUCHER_KEY_REF,
      'zhudatuan/migration/voucher', 'REGISTRATION_MIGRATION_VOUCHER_KEY_REF_INVALID'),
  });
}

function exactReference(value: string | undefined, expected: string, code: string): string {
  if (requiredValue(value, code) !== expected) throw new Error(code);
  return expected;
}

function secureLoopbackEndpoint(value: string | undefined, port: number, code: string): string {
  let endpoint: URL;
  try { endpoint = new URL(requiredValue(value, code)); } catch { throw new Error(code); }
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== '127.0.0.1' || endpoint.port !== String(port)
    || endpoint.username || endpoint.password || endpoint.hash || endpoint.search || endpoint.pathname !== '/') throw new Error(code);
  return endpoint.origin;
}
