<<<<<<< HEAD
import { bearerToken, distinctValues, enumValue, pickEnvironment, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';
=======
import { enumValue, pickEnvironment, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

export const JOBS_ENVIRONMENT_KEYS = [
  'APP_ENV',
  'SERVICE_VERSION',
<<<<<<< HEAD
  'JOB_RUNTIME_PROFILE',
  'DATABASE_JOB_CONNECTION_REF',
  'REDIS_CONNECTION_REF',
  'SECRET_STORE_ENDPOINT',
  'SECRET_STORE_BEARER_TOKEN',
  'EXTENSION_MANIFEST_KEY_REF',
  'KMS_ENDPOINT',
  'KMS_BEARER_TOKEN',
=======
  'DATABASE_JOB_CONNECTION_REF',
  'REDIS_CONNECTION_REF',
  'SECRET_STORE_ENDPOINT',
  'EXTENSION_MANIFEST_KEY_REF',
  'KMS_ENDPOINT',
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  'WECHAT_APPLICATION_CONFIG_REF',
  'WECHAT_PAYMENT_CONFIG_REF',
  'INVOICE_CONFIG_REF',
  'PAYOUT_CONFIG_REF',
  'NOTIFICATION_CONFIG_REF',
<<<<<<< HEAD
  'IDENTITY_NOTIFICATION_CONFIG_REF',
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  'OBJECT_STORE_ENDPOINT',
  'OBJECT_STORE_TOKEN_REF',
  'JOB_WORKER_ID',
] as const;

export type JobsEnvironment = Readonly<Partial<Record<(typeof JOBS_ENVIRONMENT_KEYS)[number], string>>>;
<<<<<<< HEAD
export type JobRuntimeProfile = 'full' | 'identity-notification-only';

const IDENTITY_NOTIFICATION_KEYS = new Set<string>([
  'APP_ENV',
  'SERVICE_VERSION',
  'JOB_RUNTIME_PROFILE',
  'DATABASE_JOB_CONNECTION_REF',
  'SECRET_STORE_ENDPOINT',
  'SECRET_STORE_BEARER_TOKEN',
  'KMS_ENDPOINT',
  'KMS_BEARER_TOKEN',
  'IDENTITY_NOTIFICATION_CONFIG_REF',
  'JOB_WORKER_ID',
]);
const SERVICE_CONFIGURATION_KEY = /^(?:API_|APP_ENV$|AUTH_|DATABASE_|EXTENSION_|IDENTITY_|INVOICE_|JOB_|KMS_|NOTIFICATION_|OBJECT_|PAYMENT_|PAYOUT_|PII_|PUBLIC_|QUOTE_|REDIS_|SECRET_|SESSION_|SERVICE_VERSION$|WECHAT_)/;

export function jobsEnvironment(): JobsEnvironment {
  const source = processEnvironment();
  validateJobsEnvironment(source);
  return pickEnvironment(source, JOBS_ENVIRONMENT_KEYS);
}

export function validateJobsEnvironment(source: JobsEnvironment | EnvironmentSource): void {
  enumValue(source.APP_ENV, ['development', 'test', 'production'], 'APP_ENV_INVALID');
  const profile = jobRuntimeProfile(source);
  requiredValue(source.DATABASE_JOB_CONNECTION_REF, 'DATABASE_JOB_CONNECTION_REF_MISSING');
  requiredValue(source.SERVICE_VERSION, 'SERVICE_VERSION_MISSING');
  requiredValue(source.JOB_WORKER_ID, 'JOB_WORKER_ID_MISSING');
  if (profile === 'identity-notification-only') {
    for (const key of Object.keys(source).filter((candidate) => SERVICE_CONFIGURATION_KEY.test(candidate)
      && !IDENTITY_NOTIFICATION_KEYS.has(candidate)).sort()) throw new Error(`JOB_RUNTIME_PROFILE_KEY_FORBIDDEN:${key}`);
    requiredValue(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING');
    requiredValue(source.KMS_ENDPOINT, 'KMS_ENDPOINT_MISSING');
    const secretStoreBearer = bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
    const kmsBearer = bearerToken(source.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_INVALID');
    distinctValues(secretStoreBearer, kmsBearer, 'WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
    requiredValue(source.IDENTITY_NOTIFICATION_CONFIG_REF, 'IDENTITY_NOTIFICATION_CONFIG_REF_MISSING');
    rejectConfigured(source, [
      'REDIS_CONNECTION_REF',
      'EXTENSION_MANIFEST_KEY_REF',
      'WECHAT_APPLICATION_CONFIG_REF',
      'WECHAT_PAYMENT_CONFIG_REF',
      'INVOICE_CONFIG_REF',
      'PAYOUT_CONFIG_REF',
      'NOTIFICATION_CONFIG_REF',
      'OBJECT_STORE_ENDPOINT',
      'OBJECT_STORE_TOKEN_REF',
    ]);
    return;
  }
  rejectConfigured(source, ['IDENTITY_NOTIFICATION_CONFIG_REF']);
  requiredValue(source.REDIS_CONNECTION_REF, 'REDIS_CONNECTION_REF_MISSING');
  requiredValue(source.EXTENSION_MANIFEST_KEY_REF, 'EXTENSION_MANIFEST_KEY_REF_MISSING');
  requiredValue(source.KMS_ENDPOINT, 'KMS_ENDPOINT_MISSING');
  requiredValue(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING');
  const kmsBearer = bearerToken(source.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_INVALID');
  const secretStoreBearer = bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kmsBearer, secretStoreBearer, 'WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
=======

export function jobsEnvironment(): JobsEnvironment {
  const environment = pickEnvironment(processEnvironment(), JOBS_ENVIRONMENT_KEYS);
  validateJobsEnvironment(environment);
  return environment;
}

export function validateJobsEnvironment(source: JobsEnvironment | EnvironmentSource): void {
  const app = enumValue(source.APP_ENV, ['development', 'test', 'production'], 'APP_ENV_INVALID');
  requiredValue(source.DATABASE_JOB_CONNECTION_REF, 'DATABASE_JOB_CONNECTION_REF_MISSING');
  requiredValue(source.SERVICE_VERSION, 'SERVICE_VERSION_MISSING');
  requiredValue(source.REDIS_CONNECTION_REF, 'REDIS_CONNECTION_REF_MISSING');
  requiredValue(source.JOB_WORKER_ID, 'JOB_WORKER_ID_MISSING');
  requiredValue(source.EXTENSION_MANIFEST_KEY_REF, 'EXTENSION_MANIFEST_KEY_REF_MISSING');
  requiredValue(source.KMS_ENDPOINT, 'KMS_ENDPOINT_MISSING');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  requiredValue(source.WECHAT_APPLICATION_CONFIG_REF, 'WECHAT_APPLICATION_CONFIG_REF_MISSING');
  requiredValue(source.WECHAT_PAYMENT_CONFIG_REF, 'WECHAT_PAYMENT_CONFIG_REF_MISSING');
  requiredValue(source.INVOICE_CONFIG_REF, 'INVOICE_CONFIG_REF_MISSING');
  requiredValue(source.PAYOUT_CONFIG_REF, 'PAYOUT_CONFIG_REF_MISSING');
  requiredValue(source.NOTIFICATION_CONFIG_REF, 'NOTIFICATION_CONFIG_REF_MISSING');
  requiredValue(source.OBJECT_STORE_ENDPOINT, 'OBJECT_STORE_ENDPOINT_MISSING');
  requiredValue(source.OBJECT_STORE_TOKEN_REF, 'OBJECT_STORE_TOKEN_REF_MISSING');
<<<<<<< HEAD
}

export function jobRuntimeProfile(source: JobsEnvironment | EnvironmentSource): JobRuntimeProfile {
  return enumValue(source.JOB_RUNTIME_PROFILE, ['full', 'identity-notification-only'], 'JOB_RUNTIME_PROFILE_INVALID');
}

function rejectConfigured(source: JobsEnvironment | EnvironmentSource, keys: readonly (typeof JOBS_ENVIRONMENT_KEYS)[number][]): void {
  for (const key of keys) {
    if (source[key]?.trim()) throw new Error(`JOB_RUNTIME_PROFILE_KEY_FORBIDDEN:${key}`);
  }
=======
  if (app === 'production') requiredValue(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}
