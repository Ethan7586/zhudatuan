import { bearerToken, distinctValues, integerValue, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';

export const LOCAL_ENVIRONMENT_KEYS = Object.freeze({
  tlsKeyFile: 'LOCAL_TLS_KEY_FILE',
  tlsCertificateFile: 'LOCAL_TLS_CERT_FILE',
  secretsFile: 'LOCAL_SECRETS_FILE',
  secretsPort: 'LOCAL_SECRETS_PORT',
  kmsPort: 'LOCAL_KMS_PORT',
  kmsMasterKey: 'LOCAL_KMS_MASTER_KEY',
  kmsBearerToken: 'LOCAL_KMS_BEARER_TOKEN',
  secretStoreBearerToken: 'LOCAL_SECRET_STORE_BEARER_TOKEN',
  objectsPort: 'LOCAL_OBJECTS_PORT',
  objectsDirectory: 'LOCAL_OBJECTS_DIRECTORY',
  objectsToken: 'LOCAL_OBJECTS_TOKEN',
  postgresDatabase: 'POSTGRES_DB',
  postgresUser: 'POSTGRES_USER',
  postgresPassword: 'POSTGRES_PASSWORD',
  postgresApiPassword: 'SHOPAPP_PASSWORD',
  postgresJobsPassword: 'SHOPJOB_PASSWORD',
  postgresMigrationPassword: 'SHOPMIGRATION_PASSWORD',
  redisPassword: 'REDIS_PASSWORD',
  nodeExtraCaCertificates: 'NODE_EXTRA_CA_CERTS',
  runtimeProfile: 'LOCAL_RUNTIME_PROFILE',
  adminDatabaseConnectionRef: 'LOCAL_ADMIN_DATABASE_CONNECTION_REF',
  migrationDatabaseConnectionRef: 'MIGRATION_DATABASE_CONNECTION_REF',
  ethanPasswordRef: 'LOCAL_ETHAN_PASSWORD_REF',
} as const);

export interface LocalInfrastructureEnvironment {
  readonly kmsBearerToken: string;
  readonly kmsMasterKey: string;
  readonly kmsPort: number;
  readonly objectsDirectory: string;
  readonly objectsPort: number;
  readonly objectsToken: string;
  readonly secretsFile: string;
  readonly secretsPort: number;
  readonly secretStoreBearerToken: string;
  readonly tlsCertificateFile: string;
  readonly tlsKeyFile: string;
  readonly workloadAccessPolicyFile?: string;
}

export interface LocalSeedEnvironment {
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
}

export interface LocalIdentityInfrastructureEnvironment {
  readonly kmsBearerToken: string;
  readonly kmsMasterKey: string;
  readonly kmsPort: number;
  readonly secretsFile: string;
  readonly secretsPort: number;
  readonly secretStoreBearerToken: string;
  readonly tlsCertificateFile: string;
  readonly tlsKeyFile: string;
}

const IDENTITY_INFRASTRUCTURE_KEYS = new Set([
  'APP_ENV','LOCAL_RUNTIME_PROFILE','LOCAL_TLS_KEY_FILE','LOCAL_TLS_CERT_FILE','LOCAL_SECRETS_FILE','LOCAL_SECRETS_PORT',
  'LOCAL_KMS_PORT','LOCAL_KMS_MASTER_KEY','LOCAL_KMS_BEARER_TOKEN','LOCAL_SECRET_STORE_BEARER_TOKEN','NODE_EXTRA_CA_CERTS',
]);
const LOCAL_CONFIGURATION_KEY = /^(?:APP_ENV$|LOCAL_|NODE_EXTRA_CA_CERTS$|OBJECT_|REDIS_)/;

export function localIdentityInfrastructureEnvironment(
  source: EnvironmentSource = processEnvironment(),
): LocalIdentityInfrastructureEnvironment {
  if (source.LOCAL_RUNTIME_PROFILE === 'registration-only') {
    for (const key of Object.keys(source).filter((candidate) => LOCAL_CONFIGURATION_KEY.test(candidate)
      && !IDENTITY_INFRASTRUCTURE_KEYS.has(candidate)).sort()) throw new Error(`IDENTITY_INTERNAL_RUNTIME_KEY_FORBIDDEN:${key}`);
    if (source.APP_ENV !== 'production') throw new Error('IDENTITY_INTERNAL_RUNTIME_PRODUCTION_REQUIRED');
  } else if (source.LOCAL_RUNTIME_PROFILE !== undefined) throw new Error('IDENTITY_INTERNAL_RUNTIME_PROFILE_INVALID');
  const kmsBearerToken = bearerToken(source.LOCAL_KMS_BEARER_TOKEN, 'LOCAL_KMS_BEARER_TOKEN_INVALID');
  const secretStoreBearerToken = bearerToken(source.LOCAL_SECRET_STORE_BEARER_TOKEN, 'LOCAL_SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kmsBearerToken, secretStoreBearerToken, 'LOCAL_WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  return Object.freeze({
    tlsKeyFile: requiredValue(source.LOCAL_TLS_KEY_FILE, 'LOCAL_TLS_KEY_FILE_MISSING'),
    tlsCertificateFile: requiredValue(source.LOCAL_TLS_CERT_FILE, 'LOCAL_TLS_CERT_FILE_MISSING'),
    secretsFile: requiredValue(source.LOCAL_SECRETS_FILE, 'LOCAL_SECRETS_FILE_MISSING'),
    secretsPort: integerValue(source.LOCAL_SECRETS_PORT, 8443, 1024, 65_535, 'LOCAL_SECRETS_PORT_INVALID'),
    kmsPort: integerValue(source.LOCAL_KMS_PORT, 8444, 1024, 65_535, 'LOCAL_KMS_PORT_INVALID'),
    kmsMasterKey: requiredValue(source.LOCAL_KMS_MASTER_KEY, 'LOCAL_KMS_MASTER_KEY_MISSING'),
    kmsBearerToken,
    secretStoreBearerToken,
  });
}

export function localInfrastructureEnvironment(source: EnvironmentSource = processEnvironment()): LocalInfrastructureEnvironment {
  const kmsBearerToken = bearerToken(source.LOCAL_KMS_BEARER_TOKEN, 'LOCAL_KMS_BEARER_TOKEN_INVALID');
  const secretStoreBearerToken = bearerToken(source.LOCAL_SECRET_STORE_BEARER_TOKEN, 'LOCAL_SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kmsBearerToken, secretStoreBearerToken, 'LOCAL_WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  return Object.freeze({
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
    objectsToken: requiredValue(source.LOCAL_OBJECTS_TOKEN, 'LOCAL_OBJECTS_TOKEN_MISSING'),
  });
}

export function localSeedEnvironment(source: EnvironmentSource = processEnvironment()): LocalSeedEnvironment {
  const secretStoreEndpoint = secureEndpoint(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_INVALID');
  const kmsBearerToken = bearerToken(source.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_INVALID');
  const secretStoreBearerToken = bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kmsBearerToken, secretStoreBearerToken, 'WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  return Object.freeze({
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
