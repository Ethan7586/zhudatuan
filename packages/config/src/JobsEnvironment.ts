import { enumValue, pickEnvironment, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';

export const JOBS_ENVIRONMENT_KEYS = [
  'APP_ENV',
  'SERVICE_VERSION',
  'DATABASE_JOB_CONNECTION_REF',
  'REDIS_CONNECTION_REF',
  'SECRET_STORE_ENDPOINT',
  'EXTENSION_MANIFEST_KEY_REF',
  'KMS_ENDPOINT',
  'WECHAT_APPLICATION_CONFIG_REF',
  'WECHAT_PAYMENT_CONFIG_REF',
  'INVOICE_CONFIG_REF',
  'PAYOUT_CONFIG_REF',
  'NOTIFICATION_CONFIG_REF',
  'OBJECT_STORE_ENDPOINT',
  'OBJECT_STORE_TOKEN_REF',
  'JOB_WORKER_ID',
] as const;

export type JobsEnvironment = Readonly<Partial<Record<(typeof JOBS_ENVIRONMENT_KEYS)[number], string>>>;

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
  requiredValue(source.WECHAT_APPLICATION_CONFIG_REF, 'WECHAT_APPLICATION_CONFIG_REF_MISSING');
  requiredValue(source.WECHAT_PAYMENT_CONFIG_REF, 'WECHAT_PAYMENT_CONFIG_REF_MISSING');
  requiredValue(source.INVOICE_CONFIG_REF, 'INVOICE_CONFIG_REF_MISSING');
  requiredValue(source.PAYOUT_CONFIG_REF, 'PAYOUT_CONFIG_REF_MISSING');
  requiredValue(source.NOTIFICATION_CONFIG_REF, 'NOTIFICATION_CONFIG_REF_MISSING');
  requiredValue(source.OBJECT_STORE_ENDPOINT, 'OBJECT_STORE_ENDPOINT_MISSING');
  requiredValue(source.OBJECT_STORE_TOKEN_REF, 'OBJECT_STORE_TOKEN_REF_MISSING');
  if (app === 'production') requiredValue(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING');
}
