<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { bearerToken, distinctValues, integerValue, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';
=======
import { integerValue, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { bearerToken, distinctValues, integerValue, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
import { integerValue, processEnvironment, requiredValue, type EnvironmentSource } from './Environment';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

export const LOCAL_ENVIRONMENT_KEYS = Object.freeze({
  tlsKeyFile: 'LOCAL_TLS_KEY_FILE',
  tlsCertificateFile: 'LOCAL_TLS_CERT_FILE',
  secretsFile: 'LOCAL_SECRETS_FILE',
  secretsPort: 'LOCAL_SECRETS_PORT',
  kmsPort: 'LOCAL_KMS_PORT',
  kmsMasterKey: 'LOCAL_KMS_MASTER_KEY',
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  kmsBearerToken: 'LOCAL_KMS_BEARER_TOKEN',
  secretStoreBearerToken: 'LOCAL_SECRET_STORE_BEARER_TOKEN',
  workloadAccessPolicyFile: 'LOCAL_WORKLOAD_ACCESS_POLICY_FILE',
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  kmsBearerToken: 'LOCAL_KMS_BEARER_TOKEN',
  secretStoreBearerToken: 'LOCAL_SECRET_STORE_BEARER_TOKEN',
  workloadAccessPolicyFile: 'LOCAL_WORKLOAD_ACCESS_POLICY_FILE',
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  runtimeProfile: 'LOCAL_RUNTIME_PROFILE',
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  runtimeProfile: 'LOCAL_RUNTIME_PROFILE',
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  adminDatabaseConnectionRef: 'LOCAL_ADMIN_DATABASE_CONNECTION_REF',
  migrationDatabaseConnectionRef: 'MIGRATION_DATABASE_CONNECTION_REF',
  ethanPasswordRef: 'LOCAL_ETHAN_PASSWORD_REF',
} as const);

export interface LocalInfrastructureEnvironment {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  readonly kmsBearerToken?: string;
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  readonly kmsBearerToken?: string;
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  readonly kmsMasterKey: string;
  readonly kmsPort: number;
  readonly objectsDirectory: string;
  readonly objectsPort: number;
  readonly objectsToken: string;
  readonly secretsFile: string;
  readonly secretsPort: number;
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  readonly secretStoreBearerToken?: string;
  readonly tlsCertificateFile: string;
  readonly tlsKeyFile: string;
  readonly workloadAccessPolicyFile?: string;
<<<<<<< HEAD
=======
  readonly tlsCertificateFile: string;
  readonly tlsKeyFile: string;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  readonly tlsCertificateFile: string;
  readonly tlsKeyFile: string;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

export interface LocalSeedEnvironment {
  readonly adminDatabaseConnectionRef: string;
  readonly ethanPasswordRef: string;
  readonly identityKeyRef: string;
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  readonly kmsBearerToken: string;
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  readonly kmsBearerToken: string;
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  readonly kmsEndpoint: string;
  readonly migrationDatabaseConnectionRef: string;
  readonly objectStoreEndpoint: string;
  readonly objectStoreTokenRef: string;
  readonly secretStoreEndpoint: string;
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  readonly secretStoreBearerToken: string;
}

export interface LocalIdentityInfrastructureEnvironment {
  readonly kmsBearerToken?: string;
  readonly kmsMasterKey: string;
  readonly kmsPort: number;
  readonly secretsFile: string;
  readonly secretsPort: number;
  readonly objectsToken?: string;
  readonly secretStoreBearerToken?: string;
  readonly tlsCertificateFile: string;
  readonly tlsKeyFile: string;
  readonly workloadAccessPolicyFile?: string;
}

const IDENTITY_INFRASTRUCTURE_KEYS = new Set([
  'APP_ENV','LOCAL_RUNTIME_PROFILE','LOCAL_TLS_KEY_FILE','LOCAL_TLS_CERT_FILE','LOCAL_SECRETS_FILE','LOCAL_SECRETS_PORT',
  'LOCAL_KMS_PORT','LOCAL_KMS_MASTER_KEY','LOCAL_KMS_BEARER_TOKEN','LOCAL_SECRET_STORE_BEARER_TOKEN','NODE_EXTRA_CA_CERTS',
]);
const FULL_STAGING_INFRASTRUCTURE_KEYS = new Set([
  ...[...IDENTITY_INFRASTRUCTURE_KEYS].filter((key) => key !== 'LOCAL_KMS_BEARER_TOKEN' && key !== 'LOCAL_SECRET_STORE_BEARER_TOKEN'),
  'LOCAL_WORKLOAD_ACCESS_POLICY_FILE',
  'LOCAL_OBJECTS_PORT','LOCAL_OBJECTS_DIRECTORY','LOCAL_OBJECTS_TOKEN',
]);
const LOCAL_CONFIGURATION_KEY = /^(?:APP_ENV$|LOCAL_|NODE_EXTRA_CA_CERTS$|OBJECT_|REDIS_)/;
const FULL_STAGING_SHARED = '/opt/zhudatuan-staging-full/shared';
const FULL_STAGING_INTERNAL_CREDENTIALS = '/run/credentials/zhudatuan-staging-full-internal-runtime.service';

export function localIdentityInfrastructureEnvironment(
  source: EnvironmentSource = processEnvironment(),
): LocalIdentityInfrastructureEnvironment {
  if (source.LOCAL_RUNTIME_PROFILE === 'registration-only' || source.LOCAL_RUNTIME_PROFILE === 'full-staging') {
    const allowed = source.LOCAL_RUNTIME_PROFILE === 'full-staging'
      ? FULL_STAGING_INFRASTRUCTURE_KEYS
      : IDENTITY_INFRASTRUCTURE_KEYS;
    rejectUnknownLocalKeys(source, allowed, 'IDENTITY_INTERNAL_RUNTIME_KEY_FORBIDDEN');
    if (source.APP_ENV !== 'production') throw new Error('IDENTITY_INTERNAL_RUNTIME_PRODUCTION_REQUIRED');
  } else if (source.LOCAL_RUNTIME_PROFILE !== undefined) throw new Error('IDENTITY_INTERNAL_RUNTIME_PROFILE_INVALID');
  const fullStaging = source.LOCAL_RUNTIME_PROFILE === 'full-staging';
  const legacyTokens = fullStaging ? undefined : {
    kmsBearerToken: bearerToken(source.LOCAL_KMS_BEARER_TOKEN, 'LOCAL_KMS_BEARER_TOKEN_INVALID'),
    secretStoreBearerToken: bearerToken(source.LOCAL_SECRET_STORE_BEARER_TOKEN, 'LOCAL_SECRET_STORE_BEARER_TOKEN_INVALID'),
  };
  if (legacyTokens !== undefined) distinctValues(legacyTokens.kmsBearerToken, legacyTokens.secretStoreBearerToken,
    'LOCAL_WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  const policy = fullStaging ? {
    workloadAccessPolicyFile: requiredValue(source.LOCAL_WORKLOAD_ACCESS_POLICY_FILE, 'LOCAL_WORKLOAD_ACCESS_POLICY_FILE_MISSING'),
    objectsToken: bearerToken(source.LOCAL_OBJECTS_TOKEN, 'LOCAL_OBJECTS_TOKEN_INVALID'),
  } : undefined;
  const environment = {
    tlsKeyFile: requiredValue(source.LOCAL_TLS_KEY_FILE, 'LOCAL_TLS_KEY_FILE_MISSING'),
    tlsCertificateFile: requiredValue(source.LOCAL_TLS_CERT_FILE, 'LOCAL_TLS_CERT_FILE_MISSING'),
    secretsFile: requiredValue(source.LOCAL_SECRETS_FILE, 'LOCAL_SECRETS_FILE_MISSING'),
    secretsPort: integerValue(source.LOCAL_SECRETS_PORT, 8443, 1024, 65_535, 'LOCAL_SECRETS_PORT_INVALID'),
    kmsPort: integerValue(source.LOCAL_KMS_PORT, 8444, 1024, 65_535, 'LOCAL_KMS_PORT_INVALID'),
    kmsMasterKey: requiredValue(source.LOCAL_KMS_MASTER_KEY, 'LOCAL_KMS_MASTER_KEY_MISSING'),
    ...(legacyTokens ?? {}),
    ...(policy ?? {}),
  };
  if (source.LOCAL_RUNTIME_PROFILE === 'full-staging') {
    assertFullStagingIdentityBoundary(source, environment, source !== processEnvironment());
  }
  return Object.freeze(environment);
}

export function localInfrastructureEnvironment(source: EnvironmentSource = processEnvironment()): LocalInfrastructureEnvironment {
  const fullStaging = source.LOCAL_RUNTIME_PROFILE === 'full-staging';
  if (fullStaging) {
    rejectUnknownLocalKeys(source, FULL_STAGING_INFRASTRUCTURE_KEYS, 'FULL_STAGING_INTERNAL_RUNTIME_KEY_FORBIDDEN');
    if (source.APP_ENV !== 'production') throw new Error('FULL_STAGING_INTERNAL_RUNTIME_PRODUCTION_REQUIRED');
  } else if (source.LOCAL_RUNTIME_PROFILE !== undefined) throw new Error('LOCAL_RUNTIME_PROFILE_INVALID');
  const legacyTokens = fullStaging ? undefined : {
    kmsBearerToken: bearerToken(source.LOCAL_KMS_BEARER_TOKEN, 'LOCAL_KMS_BEARER_TOKEN_INVALID'),
    secretStoreBearerToken: bearerToken(source.LOCAL_SECRET_STORE_BEARER_TOKEN, 'LOCAL_SECRET_STORE_BEARER_TOKEN_INVALID'),
  };
  if (legacyTokens !== undefined) distinctValues(legacyTokens.kmsBearerToken, legacyTokens.secretStoreBearerToken,
    'LOCAL_WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  const objectsPort = integerValue(source.LOCAL_OBJECTS_PORT, 8445, 1024, 65_535, 'LOCAL_OBJECTS_PORT_INVALID');
  const objectsDirectory = requiredValue(source.LOCAL_OBJECTS_DIRECTORY, 'LOCAL_OBJECTS_DIRECTORY_MISSING');
  const objectsToken = fullStaging
    ? bearerToken(source.LOCAL_OBJECTS_TOKEN, 'LOCAL_OBJECTS_TOKEN_INVALID')
    : requiredValue(source.LOCAL_OBJECTS_TOKEN, 'LOCAL_OBJECTS_TOKEN_MISSING');
  if (fullStaging) {
    if (objectsPort !== 8645) throw new Error('FULL_STAGING_OBJECTS_PORT_INVALID');
    if (objectsDirectory !== '/var/lib/zhudatuan-staging-full/objects') throw new Error('FULL_STAGING_OBJECTS_DIRECTORY_INVALID');
  }
  const workloadAccessPolicyFile = fullStaging
    ? requiredValue(source.LOCAL_WORKLOAD_ACCESS_POLICY_FILE, 'LOCAL_WORKLOAD_ACCESS_POLICY_FILE_MISSING')
    : undefined;
  const environment = {
<<<<<<< HEAD
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

export function localInfrastructureEnvironment(source: EnvironmentSource = processEnvironment()): LocalInfrastructureEnvironment {
  return Object.freeze({
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    tlsKeyFile: requiredValue(source.LOCAL_TLS_KEY_FILE, 'LOCAL_TLS_KEY_FILE_MISSING'),
    tlsCertificateFile: requiredValue(source.LOCAL_TLS_CERT_FILE, 'LOCAL_TLS_CERT_FILE_MISSING'),
    secretsFile: requiredValue(source.LOCAL_SECRETS_FILE, 'LOCAL_SECRETS_FILE_MISSING'),
    secretsPort: integerValue(source.LOCAL_SECRETS_PORT, 8443, 1024, 65_535, 'LOCAL_SECRETS_PORT_INVALID'),
    kmsPort: integerValue(source.LOCAL_KMS_PORT, 8444, 1024, 65_535, 'LOCAL_KMS_PORT_INVALID'),
    kmsMasterKey: requiredValue(source.LOCAL_KMS_MASTER_KEY, 'LOCAL_KMS_MASTER_KEY_MISSING'),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    ...(legacyTokens ?? {}),
    ...(workloadAccessPolicyFile === undefined ? {} : { workloadAccessPolicyFile }),
    objectsPort,
    objectsDirectory,
    objectsToken,
  };
  if (fullStaging) assertFullStagingIdentityBoundary(source, environment, source !== processEnvironment());
  return Object.freeze(environment);
}

function assertFullStagingIdentityBoundary(
  source: EnvironmentSource,
  environment: Pick<LocalIdentityInfrastructureEnvironment, 'kmsPort' | 'secretsFile' | 'secretsPort' | 'tlsCertificateFile' | 'tlsKeyFile'>,
  staticValidation: boolean,
): void {
  if (environment.secretsPort !== 8643) throw new Error('FULL_STAGING_SECRETS_PORT_INVALID');
  if (environment.kmsPort !== 8644) throw new Error('FULL_STAGING_KMS_PORT_INVALID');
  assertFullStagingCredentialPath(environment.tlsKeyFile, 'internal-tls-key', `${FULL_STAGING_SHARED}/tls/internal.key`,
    staticValidation, 'FULL_STAGING_TLS_KEY_FILE_INVALID');
  assertFullStagingCredentialPath(environment.tlsCertificateFile, 'internal-tls-certificate', `${FULL_STAGING_SHARED}/tls/internal.crt`,
    staticValidation, 'FULL_STAGING_TLS_CERTIFICATE_FILE_INVALID');
  assertFullStagingCredentialPath(environment.secretsFile, 'secrets-catalog', `${FULL_STAGING_SHARED}/full-secrets.json`,
    staticValidation, 'FULL_STAGING_SECRETS_FILE_INVALID');
  assertFullStagingCredentialPath(source.LOCAL_WORKLOAD_ACCESS_POLICY_FILE, 'workload-access-policy',
    `${FULL_STAGING_SHARED}/full-internal-access.json`, staticValidation, 'FULL_STAGING_WORKLOAD_ACCESS_POLICY_FILE_INVALID');
  assertFullStagingCredentialPath(source.NODE_EXTRA_CA_CERTS, 'internal-ca-certificate', `${FULL_STAGING_SHARED}/tls/internal-ca.crt`,
    staticValidation, 'FULL_STAGING_CA_FILE_INVALID');
}

function assertFullStagingCredentialPath(
  actual: string | undefined,
  credential: string,
  staticSource: string,
  staticValidation: boolean,
  code: string,
): void {
  const runtime = `${FULL_STAGING_INTERNAL_CREDENTIALS}/${credential}`;
  if (actual !== runtime && !(staticValidation && actual === staticSource)) throw new Error(code);
}

function rejectUnknownLocalKeys(source: EnvironmentSource, allowed: ReadonlySet<string>, code: string): void {
  for (const key of Object.keys(source).filter((candidate) => LOCAL_CONFIGURATION_KEY.test(candidate)
    && !allowed.has(candidate)).sort()) throw new Error(`${code}:${key}`);
<<<<<<< HEAD
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    objectsPort: integerValue(source.LOCAL_OBJECTS_PORT, 8445, 1024, 65_535, 'LOCAL_OBJECTS_PORT_INVALID'),
    objectsDirectory: requiredValue(source.LOCAL_OBJECTS_DIRECTORY, 'LOCAL_OBJECTS_DIRECTORY_MISSING'),
    objectsToken: requiredValue(source.LOCAL_OBJECTS_TOKEN, 'LOCAL_OBJECTS_TOKEN_MISSING'),
  });
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

export function localSeedEnvironment(source: EnvironmentSource = processEnvironment()): LocalSeedEnvironment {
  const secretStoreEndpoint = secureEndpoint(source.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_INVALID');
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  const kmsBearerToken = bearerToken(source.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_INVALID');
  const secretStoreBearerToken = bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kmsBearerToken, secretStoreBearerToken, 'WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const kmsBearerToken = bearerToken(source.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_INVALID');
  const secretStoreBearerToken = bearerToken(source.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_INVALID');
  distinctValues(kmsBearerToken, secretStoreBearerToken, 'WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  return Object.freeze({
    secretStoreEndpoint,
    adminDatabaseConnectionRef: reference(source.LOCAL_ADMIN_DATABASE_CONNECTION_REF, 'LOCAL_ADMIN_DATABASE_CONNECTION_REF_INVALID'),
    ethanPasswordRef: reference(source.LOCAL_ETHAN_PASSWORD_REF, 'LOCAL_ETHAN_PASSWORD_REF_INVALID'),
    identityKeyRef: reference(source.IDENTITY_KEY_REF, 'IDENTITY_KEY_REF_INVALID'),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    kmsBearerToken,
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    kmsBearerToken,
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    kmsEndpoint: secureEndpoint(source.KMS_ENDPOINT, 'KMS_ENDPOINT_INVALID'),
    migrationDatabaseConnectionRef: reference(source.MIGRATION_DATABASE_CONNECTION_REF, 'MIGRATION_DATABASE_CONNECTION_REF_INVALID'),
    objectStoreEndpoint: secureEndpoint(source.OBJECT_STORE_ENDPOINT, 'OBJECT_STORE_ENDPOINT_INVALID'),
    objectStoreTokenRef: reference(source.OBJECT_STORE_TOKEN_REF, 'OBJECT_STORE_TOKEN_REF_INVALID'),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    secretStoreBearerToken,
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    secretStoreBearerToken,
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
