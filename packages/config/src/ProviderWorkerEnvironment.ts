import { bearerToken, distinctValues, enumValue, pickEnvironment, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';

export const PROVIDER_WORKER_ENVIRONMENT_KEYS = [
  'APP_ENV',
  'SERVICE_VERSION',
  'DATABASE_PROVIDER_CONNECTION_REF',
  'SECRET_STORE_ENDPOINT',
  'SECRET_STORE_BEARER_TOKEN',
  'EXTENSION_MANIFEST_KEY_REF',
  'KMS_ENDPOINT',
  'KMS_BEARER_TOKEN',
  'PROVIDER_WORKER_ID',
] as const;

export type ProviderWorkerEnvironment = Readonly<Partial<Record<(typeof PROVIDER_WORKER_ENVIRONMENT_KEYS)[number], string>>>;

export function providerWorkerEnvironment(): ProviderWorkerEnvironment {
  const source = processEnvironment();
  validateProviderWorkerEnvironment(source);
  return pickEnvironment(source, PROVIDER_WORKER_ENVIRONMENT_KEYS);
}

export function validateProviderWorkerEnvironment(source: ProviderWorkerEnvironment | EnvironmentSource): void {
  enumValue(source.APP_ENV, ['development', 'test', 'production'], 'APP_ENV_INVALID');
  for (const [key, code] of [
    ['SERVICE_VERSION', 'SERVICE_VERSION_MISSING'],
    ['DATABASE_PROVIDER_CONNECTION_REF', 'DATABASE_PROVIDER_CONNECTION_REF_MISSING'],
    ['SECRET_STORE_ENDPOINT', 'SECRET_STORE_ENDPOINT_MISSING'],
    ['EXTENSION_MANIFEST_KEY_REF', 'EXTENSION_MANIFEST_KEY_REF_MISSING'],
    ['KMS_ENDPOINT', 'KMS_ENDPOINT_MISSING'],
    ['PROVIDER_WORKER_ID', 'PROVIDER_WORKER_ID_MISSING'],
  ] as const)
    requiredValue(source[key], code);
  const kms = bearerToken(source.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_INVALID');
  const secrets = bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kms, secrets, 'WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
}
