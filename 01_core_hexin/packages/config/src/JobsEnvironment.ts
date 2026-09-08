import { bearerToken, distinctValues, enumValue, pickEnvironment, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';

export const JOBS_ENVIRONMENT_KEYS = [
  'APP_ENV',
  'SERVICE_VERSION',
  'JOB_RUNTIME_PROFILE',
  'DATABASE_JOB_CONNECTION_REF',
  'DATABASE_JOB_ROLE',
  'REDIS_CONNECTION_REF',
  'SECRET_STORE_ENDPOINT',
  'SECRET_STORE_BEARER_TOKEN',
  'EXTENSION_MANIFEST_KEY_REF',
  'KMS_ENDPOINT',
  'KMS_BEARER_TOKEN',
  'WECHAT_APPLICATION_CONFIG_REF',
  'WECHAT_PAYMENT_CONFIG_REF',
  'INVOICE_CONFIG_REF',
  'PAYOUT_CONFIG_REF',
  'NOTIFICATION_CONFIG_REF',
  'IDENTITY_NOTIFICATION_CONFIG_REF',
  'OBJECT_STORE_ENDPOINT',
  'OBJECT_STORE_TOKEN_REF',
  'JOB_WORKER_ID',
  'NODE_MANIFEST_PATH',
  'NODE_MANIFEST_ID',
  'NODE_MANIFEST_DIGEST',
  'NODE_RUNTIME_INSTANCE_ID',
  'NODE_RUNTIME_CONFIG_REF',
  'NODE_RESOURCE_BINDING_VERSION',
  'NODE_RELEASE_POINTER_REF',
] as const;

export type JobsEnvironment = Readonly<Partial<Record<(typeof JOBS_ENVIRONMENT_KEYS)[number], string>>>;
export type JobRuntimeProfile = 'full' | 'identity-notification-only' | 'payment-only';

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
const PAYMENT_KEYS = new Set<string>([
  'APP_ENV',
  'SERVICE_VERSION',
  'JOB_RUNTIME_PROFILE',
  'DATABASE_JOB_CONNECTION_REF',
  'DATABASE_JOB_ROLE',
  'SECRET_STORE_ENDPOINT',
  'SECRET_STORE_BEARER_TOKEN',
  'WECHAT_APPLICATION_CONFIG_REF',
  'WECHAT_PAYMENT_CONFIG_REF',
  'JOB_WORKER_ID',
  'NODE_MANIFEST_PATH',
  'NODE_MANIFEST_ID',
  'NODE_MANIFEST_DIGEST',
  'NODE_RUNTIME_INSTANCE_ID',
  'NODE_RUNTIME_CONFIG_REF',
  'NODE_RESOURCE_BINDING_VERSION',
  'NODE_RELEASE_POINTER_REF',
]);
const SERVICE_CONFIGURATION_KEY = /^(?:API_|APP_ENV$|AUTH_|DATABASE_|EXTENSION_|IDENTITY_|INVOICE_|JOB_|KMS_|NODE_(?:MANIFEST_|RUNTIME_|RESOURCE_|RELEASE_)|NOTIFICATION_|OBJECT_|PAYMENT_|PAYOUT_|PII_|PUBLIC_|QUOTE_|REDIS_|SECRET_|SESSION_|SERVICE_VERSION$|WECHAT_)/;

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
  if (profile === 'payment-only') {
    for (const key of Object.keys(source).filter((candidate) => SERVICE_CONFIGURATION_KEY.test(candidate)
      && !PAYMENT_KEYS.has(candidate)).sort()) throw new Error(`JOB_RUNTIME_PROFILE_KEY_FORBIDDEN:${key}`);
    requiredValue(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING');
    requiredValue(source.DATABASE_JOB_ROLE, 'DATABASE_JOB_ROLE_MISSING');
    bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
    requiredValue(source.WECHAT_APPLICATION_CONFIG_REF, 'WECHAT_APPLICATION_CONFIG_REF_MISSING');
    requiredValue(source.WECHAT_PAYMENT_CONFIG_REF, 'WECHAT_PAYMENT_CONFIG_REF_MISSING');
    for (const [key, code] of [
      ['NODE_MANIFEST_PATH', 'NODE_MANIFEST_PATH_MISSING'],
      ['NODE_MANIFEST_ID', 'NODE_MANIFEST_ID_MISSING'],
      ['NODE_RUNTIME_INSTANCE_ID', 'NODE_RUNTIME_INSTANCE_ID_MISSING'],
      ['NODE_RUNTIME_CONFIG_REF', 'NODE_RUNTIME_CONFIG_REF_MISSING'],
      ['NODE_RESOURCE_BINDING_VERSION', 'NODE_RESOURCE_BINDING_VERSION_MISSING'],
      ['NODE_RELEASE_POINTER_REF', 'NODE_RELEASE_POINTER_REF_MISSING'],
    ] as const) requiredValue(source[key], code);
    if (!/^sha256:[0-9a-f]{64}$/.test(requiredValue(source.NODE_MANIFEST_DIGEST, 'NODE_MANIFEST_DIGEST_INVALID'))) {
      throw new Error('NODE_MANIFEST_DIGEST_INVALID');
    }
    rejectConfigured(source, [
      'REDIS_CONNECTION_REF',
      'EXTENSION_MANIFEST_KEY_REF',
      'KMS_ENDPOINT',
      'KMS_BEARER_TOKEN',
      'INVOICE_CONFIG_REF',
      'PAYOUT_CONFIG_REF',
      'NOTIFICATION_CONFIG_REF',
      'IDENTITY_NOTIFICATION_CONFIG_REF',
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
  requiredValue(source.WECHAT_APPLICATION_CONFIG_REF, 'WECHAT_APPLICATION_CONFIG_REF_MISSING');
  requiredValue(source.WECHAT_PAYMENT_CONFIG_REF, 'WECHAT_PAYMENT_CONFIG_REF_MISSING');
  requiredValue(source.INVOICE_CONFIG_REF, 'INVOICE_CONFIG_REF_MISSING');
  requiredValue(source.PAYOUT_CONFIG_REF, 'PAYOUT_CONFIG_REF_MISSING');
  requiredValue(source.NOTIFICATION_CONFIG_REF, 'NOTIFICATION_CONFIG_REF_MISSING');
  requiredValue(source.OBJECT_STORE_ENDPOINT, 'OBJECT_STORE_ENDPOINT_MISSING');
  requiredValue(source.OBJECT_STORE_TOKEN_REF, 'OBJECT_STORE_TOKEN_REF_MISSING');
}

export function jobRuntimeProfile(source: JobsEnvironment | EnvironmentSource): JobRuntimeProfile {
  return enumValue(source.JOB_RUNTIME_PROFILE, ['full', 'identity-notification-only', 'payment-only'], 'JOB_RUNTIME_PROFILE_INVALID');
}

function rejectConfigured(source: JobsEnvironment | EnvironmentSource, keys: readonly (typeof JOBS_ENVIRONMENT_KEYS)[number][]): void {
  for (const key of keys) {
    if (source[key]?.trim()) throw new Error(`JOB_RUNTIME_PROFILE_KEY_FORBIDDEN:${key}`);
  }
}
