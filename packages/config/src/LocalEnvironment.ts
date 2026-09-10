import { bearerToken, distinctValues, integerValue, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';

export const LOCAL_ENVIRONMENT_KEYS = Object.freeze({
  bindHost: 'LOCAL_BIND_HOST',
  tlsKeyFile: 'LOCAL_TLS_KEY_FILE',
  tlsCertificateFile: 'LOCAL_TLS_CERT_FILE',
  secretsFile: 'LOCAL_SECRETS_FILE',
  credentialsFile: 'LOCAL_CREDENTIALS_FILE',
  secretsPort: 'LOCAL_SECRETS_PORT',
  kmsPort: 'LOCAL_KMS_PORT',
  kmsMasterKey: 'LOCAL_KMS_MASTER_KEY',
  kmsBearerToken: 'LOCAL_KMS_BEARER_TOKEN',
  secretStoreBearerToken: 'LOCAL_SECRET_STORE_BEARER_TOKEN',
  objectsPort: 'LOCAL_OBJECTS_PORT',
  objectsDirectory: 'LOCAL_OBJECTS_DIRECTORY',
  objectsToken: 'LOCAL_OBJECTS_TOKEN',
  objectsPublicBaseUrl: 'LOCAL_OBJECTS_PUBLIC_BASE_URL',
  providerPort: 'LOCAL_PROVIDER_PORT',
  composeProject: 'LOCAL_COMPOSE_PROJECT',
  postgresPort: 'LOCAL_POSTGRES_PORT',
  redisPort: 'LOCAL_REDIS_PORT',
  postgresDatabase: 'POSTGRES_DB',
  postgresUser: 'POSTGRES_USER',
  postgresPassword: 'POSTGRES_PASSWORD',
  postgresApiPassword: 'SHOPAPP_PASSWORD',
  postgresJobsPassword: 'SHOPJOB_PASSWORD',
  postgresProviderPassword: 'SHOPPROVIDER_PASSWORD',
  redisPassword: 'REDIS_PASSWORD',
  nodeExtraCaCertificates: 'NODE_EXTRA_CA_CERTS',
  adminDatabaseConnectionRef: 'LOCAL_ADMIN_DATABASE_CONNECTION_REF',
  migrationDatabaseConnectionRef: 'MIGRATION_DATABASE_CONNECTION_REF',
  ethanPasswordRef: 'LOCAL_ETHAN_PASSWORD_REF',
  apiEndpoint: 'LOCAL_API_ENDPOINT',
} as const);

export const LOCAL_SECRET_REFS = Object.freeze({
  postgresAdmin: 'local/postgres/admin-password',
  postgresApi: 'local/postgres/api-password',
  postgresJobs: 'local/postgres/jobs-password',
  postgresProvider: 'local/postgres/provider-password',
  redis: 'local/redis/password',
  kmsMaster: 'shop/local/kms/master',
  objects: 'shop/local/objects/api',
  identityChallengeCode: 'local/identity/challenge-code',
} as const);

export const LOCAL_CREDENTIAL_KEYS = Object.freeze({
  kmsBearerToken: 'kmsBearerToken',
  secretStoreBearerToken: 'secretStoreBearerToken',
} as const);

export interface LocalInfrastructureEnvironment {
  readonly bindHost: LocalBindHost;
  readonly kmsBearerToken: string;
  readonly kmsMasterKey: string;
  readonly kmsPort: number;
  readonly objectsDirectory: string;
  readonly objectsPort: number;
  readonly objectsPublicBaseUrl: string;
  readonly objectsToken: string;
  readonly secretsFile: string;
  readonly secretsPort: number;
  readonly secretStoreBearerToken: string;
  readonly tlsCertificateFile: string;
  readonly tlsKeyFile: string;
}

export interface LocalComposeEnvironment {
  readonly project: string | undefined;
  readonly postgresPort: number;
  readonly redisPort: number;
}

export interface LocalLaunchEnvironment {
  readonly credentialsFile: string;
  readonly secretsFile: string;
}

export interface LocalObjectEnvironment {
  readonly bindHost: LocalBindHost;
  readonly objectsDirectory: string;
  readonly objectsPort: number;
  readonly objectsPublicBaseUrl: string;
  readonly objectsToken: string;
  readonly tlsCertificateFile: string;
  readonly tlsKeyFile: string;
}

export interface LocalProviderEnvironment {
  readonly providerPort: number;
}

export interface LocalSeedEnvironment {
  readonly apiEndpoint: string;
  readonly adminDatabaseConnectionRef: string;
  readonly ethanPasswordRef: string;
  readonly identityKeyRef: string;
  readonly kmsBearerToken: string;
  readonly kmsEndpoint: string;
  readonly migrationDatabaseConnectionRef: string;
  readonly objectStoreEndpoint: string;
  readonly objectStoreTokenRef: string;
  readonly secretStoreEndpoint: string;
  readonly secretStoreBearerToken: string;
  readonly serviceVersion: string;
}

export interface LocalSecretStoreEnvironment {
  readonly bindHost: LocalBindHost;
  readonly secretsFile: string;
  readonly secretsPort: number;
  readonly secretStoreBearerToken: string;
  readonly tlsCertificateFile: string;
  readonly tlsKeyFile: string;
}

export interface LocalKmsEnvironment {
  readonly bindHost: LocalBindHost;
  readonly kmsBearerToken: string;
  readonly kmsMasterKey: string;
  readonly kmsPort: number;
  readonly tlsCertificateFile: string;
  readonly tlsKeyFile: string;
}

export function localSecretStoreEnvironment(source: EnvironmentSource = processEnvironment()): LocalSecretStoreEnvironment {
  return Object.freeze({
    bindHost: localBindHost(source.LOCAL_BIND_HOST),
    tlsKeyFile: requiredValue(source.LOCAL_TLS_KEY_FILE, 'LOCAL_TLS_KEY_FILE_MISSING'),
    tlsCertificateFile: requiredValue(source.LOCAL_TLS_CERT_FILE, 'LOCAL_TLS_CERT_FILE_MISSING'),
    secretsFile: requiredValue(source.LOCAL_SECRETS_FILE, 'LOCAL_SECRETS_FILE_MISSING'),
    secretsPort: integerValue(source.LOCAL_SECRETS_PORT, 8443, 1024, 65_535, 'LOCAL_SECRETS_PORT_INVALID'),
    secretStoreBearerToken: bearerToken(source.LOCAL_SECRET_STORE_BEARER_TOKEN, 'LOCAL_SECRET_STORE_BEARER_TOKEN_INVALID'),
  });
}

function verificationApiEndpoint(value: string | undefined): string {
  const selected = value?.trim() || 'http://127.0.0.1:3001';
  if (selected === 'http://127.0.0.1:3001' || selected === 'http://api:3001') return selected;
  return secureEndpoint(selected, 'LOCAL_API_ENDPOINT_INVALID');
}

export function localKmsEnvironment(source: EnvironmentSource = processEnvironment()): LocalKmsEnvironment {
  return Object.freeze({
    bindHost: localBindHost(source.LOCAL_BIND_HOST),
    tlsKeyFile: requiredValue(source.LOCAL_TLS_KEY_FILE, 'LOCAL_TLS_KEY_FILE_MISSING'),
    tlsCertificateFile: requiredValue(source.LOCAL_TLS_CERT_FILE, 'LOCAL_TLS_CERT_FILE_MISSING'),
    kmsPort: integerValue(source.LOCAL_KMS_PORT, 8444, 1024, 65_535, 'LOCAL_KMS_PORT_INVALID'),
    kmsMasterKey: requiredValue(source.LOCAL_KMS_MASTER_KEY, 'LOCAL_KMS_MASTER_KEY_MISSING'),
    kmsBearerToken: bearerToken(source.LOCAL_KMS_BEARER_TOKEN, 'LOCAL_KMS_BEARER_TOKEN_INVALID'),
  });
}

export function localInfrastructureEnvironment(source: EnvironmentSource = processEnvironment()): LocalInfrastructureEnvironment {
  const kmsBearerToken = bearerToken(source.LOCAL_KMS_BEARER_TOKEN, 'LOCAL_KMS_BEARER_TOKEN_INVALID');
  const secretStoreBearerToken = bearerToken(source.LOCAL_SECRET_STORE_BEARER_TOKEN, 'LOCAL_SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kmsBearerToken, secretStoreBearerToken, 'LOCAL_WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  return Object.freeze({
    bindHost: localBindHost(source.LOCAL_BIND_HOST),
    tlsKeyFile: requiredValue(source.LOCAL_TLS_KEY_FILE, 'LOCAL_TLS_KEY_FILE_MISSING'),
    tlsCertificateFile: requiredValue(source.LOCAL_TLS_CERT_FILE, 'LOCAL_TLS_CERT_FILE_MISSING'),
    secretsFile: requiredValue(source.LOCAL_SECRETS_FILE, 'LOCAL_SECRETS_FILE_MISSING'),
    secretsPort: integerValue(source.LOCAL_SECRETS_PORT, 8443, 1024, 65_535, 'LOCAL_SECRETS_PORT_INVALID'),
    kmsPort: integerValue(source.LOCAL_KMS_PORT, 8444, 1024, 65_535, 'LOCAL_KMS_PORT_INVALID'),
    kmsMasterKey: requiredValue(source.LOCAL_KMS_MASTER_KEY, 'LOCAL_KMS_MASTER_KEY_MISSING'),
    kmsBearerToken,
    secretStoreBearerToken,
    objectsPort: integerValue(source.LOCAL_OBJECTS_PORT, 8445, 1024, 65_535, 'LOCAL_OBJECTS_PORT_INVALID'),
    objectsDirectory: requiredValue(source.LOCAL_OBJECTS_DIRECTORY, 'LOCAL_OBJECTS_DIRECTORY_MISSING'),
    objectsPublicBaseUrl: secureEndpoint(source.LOCAL_OBJECTS_PUBLIC_BASE_URL, 'LOCAL_OBJECTS_PUBLIC_BASE_URL_INVALID'),
    objectsToken: requiredValue(source.LOCAL_OBJECTS_TOKEN, 'LOCAL_OBJECTS_TOKEN_MISSING'),
  });
}

export function localComposeEnvironment(source: EnvironmentSource = processEnvironment()): LocalComposeEnvironment {
  return Object.freeze({
    project: source.LOCAL_COMPOSE_PROJECT,
    postgresPort: integerValue(source.LOCAL_POSTGRES_PORT, 5432, 1024, 65_535, 'LOCAL_POSTGRES_PORT_INVALID'),
    redisPort: integerValue(source.LOCAL_REDIS_PORT, 6379, 1024, 65_535, 'LOCAL_REDIS_PORT_INVALID'),
  });
}

export function localLaunchEnvironment(source: EnvironmentSource = processEnvironment()): LocalLaunchEnvironment {
  return Object.freeze({
    credentialsFile: requiredValue(source.LOCAL_CREDENTIALS_FILE, 'LOCAL_CREDENTIALS_FILE_MISSING'),
    secretsFile: requiredValue(source.LOCAL_SECRETS_FILE, 'LOCAL_SECRETS_FILE_MISSING'),
  });
}

export function localObjectEnvironment(source: EnvironmentSource = processEnvironment()): LocalObjectEnvironment {
  return Object.freeze({
    bindHost: localBindHost(source.LOCAL_BIND_HOST),
    tlsKeyFile: requiredValue(source.LOCAL_TLS_KEY_FILE, 'LOCAL_TLS_KEY_FILE_MISSING'),
    tlsCertificateFile: requiredValue(source.LOCAL_TLS_CERT_FILE, 'LOCAL_TLS_CERT_FILE_MISSING'),
    objectsPort: integerValue(source.LOCAL_OBJECTS_PORT, 8445, 1024, 65_535, 'LOCAL_OBJECTS_PORT_INVALID'),
    objectsDirectory: requiredValue(source.LOCAL_OBJECTS_DIRECTORY, 'LOCAL_OBJECTS_DIRECTORY_MISSING'),
    objectsPublicBaseUrl: secureEndpoint(source.LOCAL_OBJECTS_PUBLIC_BASE_URL, 'LOCAL_OBJECTS_PUBLIC_BASE_URL_INVALID'),
    objectsToken: requiredValue(source.LOCAL_OBJECTS_TOKEN, 'LOCAL_OBJECTS_TOKEN_MISSING'),
  });
}

export function localProviderEnvironment(source: EnvironmentSource = processEnvironment()): LocalProviderEnvironment {
  return Object.freeze({ providerPort: integerValue(source.LOCAL_PROVIDER_PORT, 9080, 1024, 65_535, 'LOCAL_PROVIDER_PORT_INVALID') });
}

export function localSeedEnvironment(source: EnvironmentSource = processEnvironment()): LocalSeedEnvironment {
  const secretStoreEndpoint = secureEndpoint(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_INVALID');
  const kmsBearerToken = bearerToken(source.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_INVALID');
  const secretStoreBearerToken = bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kmsBearerToken, secretStoreBearerToken, 'WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  return Object.freeze({
    apiEndpoint: verificationApiEndpoint(source.LOCAL_API_ENDPOINT),
    secretStoreEndpoint,
    adminDatabaseConnectionRef: reference(source.LOCAL_ADMIN_DATABASE_CONNECTION_REF, 'LOCAL_ADMIN_DATABASE_CONNECTION_REF_INVALID'),
    ethanPasswordRef: reference(source.LOCAL_ETHAN_PASSWORD_REF, 'LOCAL_ETHAN_PASSWORD_REF_INVALID'),
    identityKeyRef: reference(source.IDENTITY_KEY_REF, 'IDENTITY_KEY_REF_INVALID'),
    kmsBearerToken,
    kmsEndpoint: secureEndpoint(source.KMS_ENDPOINT, 'KMS_ENDPOINT_INVALID'),
    migrationDatabaseConnectionRef: reference(source.MIGRATION_DATABASE_CONNECTION_REF, 'MIGRATION_DATABASE_CONNECTION_REF_INVALID'),
    objectStoreEndpoint: secureEndpoint(source.OBJECT_STORE_ENDPOINT, 'OBJECT_STORE_ENDPOINT_INVALID'),
    objectStoreTokenRef: reference(source.OBJECT_STORE_TOKEN_REF, 'OBJECT_STORE_TOKEN_REF_INVALID'),
    secretStoreBearerToken,
    serviceVersion: requiredValue(source.SERVICE_VERSION, 'SERVICE_VERSION_MISSING'),
  });
}

function reference(value: string | undefined, code: string): string {
  const selected = requiredValue(value, code);
  if (!/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(selected)) throw new Error(code);
  return selected;
}

function secureEndpoint(value: string | undefined, code: string): string {
  const selected = requiredValue(value, code);
  if (!selected.startsWith('https://')) throw new Error(code);
  return selected.replace(/\/$/, '');
}

export type LocalBindHost = '127.0.0.1' | '0.0.0.0';

function localBindHost(value: string | undefined): LocalBindHost {
  const selected = value?.trim() || '127.0.0.1';
  if (selected !== '127.0.0.1' && selected !== '0.0.0.0') throw new Error('LOCAL_BIND_HOST_INVALID');
  return selected;
}
