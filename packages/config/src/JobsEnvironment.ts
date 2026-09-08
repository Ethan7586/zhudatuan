import { bearerToken, distinctValues, enumValue, pickEnvironment, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';
import { WORKER_ENVIRONMENT_KEYS, type WorkerEnvironment } from './WorkerEnvironment';

export const JOBS_ENVIRONMENT_KEYS = [
  'APP_ENV',
  'SERVICE_VERSION',
  'DATABASE_JOB_CONNECTION_REF',
  'REDIS_CONNECTION_REF',
  'SESSION_KEY_REF',
  'IDENTITY_KEY_REF',
  'INVITATION_KEY_REF',
  'NAVIGATION_KEY_REF',
  'QUOTE_KEY_REF',
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
  'OBJECT_STORE_ENDPOINT',
  'OBJECT_STORE_TOKEN_REF',
  'JOB_WORKER_ID',
  ...WORKER_ENVIRONMENT_KEYS,
] as const;

export type JobsEnvironment = Readonly<Partial<Record<(typeof JOBS_ENVIRONMENT_KEYS)[number], string>>> & WorkerEnvironment;
export function jobsEnvironment(): JobsEnvironment {
  const source = processEnvironment();
  validateJobsEnvironment(source);
  return pickEnvironment(source, JOBS_ENVIRONMENT_KEYS);
}

export function validateJobsEnvironment(source: JobsEnvironment | EnvironmentSource): void {
  enumValue(source.APP_ENV, ['development', 'test', 'production'], 'APP_ENV_INVALID');
  requiredValue(source.DATABASE_JOB_CONNECTION_REF, 'DATABASE_JOB_CONNECTION_REF_MISSING');
  requiredValue(source.SERVICE_VERSION, 'SERVICE_VERSION_MISSING');
  requiredValue(source.JOB_WORKER_ID, 'JOB_WORKER_ID_MISSING');
  requiredValue(source.REDIS_CONNECTION_REF, 'REDIS_CONNECTION_REF_MISSING');
  requiredValue(source.SESSION_KEY_REF, 'SESSION_KEY_REF_MISSING');
  requiredValue(source.IDENTITY_KEY_REF, 'IDENTITY_KEY_REF_MISSING');
  requiredValue(source.INVITATION_KEY_REF, 'INVITATION_KEY_REF_MISSING');
  requiredValue(source.NAVIGATION_KEY_REF, 'NAVIGATION_KEY_REF_MISSING');
  requiredValue(source.QUOTE_KEY_REF, 'QUOTE_KEY_REF_MISSING');
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
