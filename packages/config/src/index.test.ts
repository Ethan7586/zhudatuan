<<<<<<< HEAD
<<<<<<< HEAD
import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { clientEnvironment } from './ClientEnvironment';
import { miniappEnvironment } from './MiniappEnvironment';
import { API_ENVIRONMENT_KEYS, IDENTITY_REGISTRATION_API_ENVIRONMENT_KEYS, JOBS_ENVIRONMENT_KEYS, LOCAL_ENVIRONMENT_KEYS, REGISTRATION_MIGRATION_ENVIRONMENT_KEYS, WechatApplicationCatalog, apiBindHost, apiReturnTargets, bearerToken, identityRegistrationApiEnvironment, integerValue, isPrivateIpv4Host, jobRuntimeProfile, localIdentityInfrastructureEnvironment, localInfrastructureEnvironment, localSeedEnvironment, registrationMigrationEnvironment, requiredValue, validateApiEnvironment, validateJobsEnvironment } from './ServerEnvironment';

const secretStoreBearerToken = 's'.repeat(43);
const kmsBearerToken = 'k'.repeat(43);
const objectsBearerToken = 'o'.repeat(43);

describe('runtime configuration schema', () => {
  it('keeps the private CA trust path in every registration-only HTTPS client env', async () => {
    const expected = 'NODE_EXTRA_CA_CERTS=/opt/zhudatuan/shared/tls/internal-ca.crt';
    for (const file of ['identity-registration-api.env.example','identity-notification-jobs.env.example',
      'migration.env.example','registration-bootstrap.env.example','owner-bootstrap.env.example','purchase-api.env.example']) {
      const source = await readFile(new URL(`../../../infrastructure/zhudatuan/aliyun/${file}`, import.meta.url), 'utf8');
      expect(source.split(/\r?\n/).filter((line) => line.startsWith('NODE_EXTRA_CA_CERTS='))).toEqual([expected]);
    }
  });

  it('owns every shared key exactly once', () => {
    expect(new Set(API_ENVIRONMENT_KEYS).size).toBe(API_ENVIRONMENT_KEYS.length);
    expect(new Set(IDENTITY_REGISTRATION_API_ENVIRONMENT_KEYS).size).toBe(IDENTITY_REGISTRATION_API_ENVIRONMENT_KEYS.length);
    expect(new Set(JOBS_ENVIRONMENT_KEYS).size).toBe(JOBS_ENVIRONMENT_KEYS.length);
    expect(new Set(REGISTRATION_MIGRATION_ENVIRONMENT_KEYS).size).toBe(REGISTRATION_MIGRATION_ENVIRONMENT_KEYS.length);
    expect(new Set(Object.values(LOCAL_ENVIRONMENT_KEYS)).size).toBe(Object.values(LOCAL_ENVIRONMENT_KEYS).length);
  });

  it('isolates strict registration migration settings from the generic migration environment', () => {
    const environment = {
      APP_ENV: 'production',
      REGISTRATION_MIGRATION_PROFILE: 'registration-only',
      MIGRATION_APPROVAL: 'hard-cut-20260821054000',
      MIGRATION_DATABASE_CONNECTION_REF: 'zhudatuan/registration/database/migration',
      MIGRATION_DIRECTORY: '/opt/zhudatuan/current/database/supabase/migrations',
      MIGRATION_DISTRIBUTOR_KEY_REF: 'zhudatuan/migration/distributor',
      MIGRATION_IDENTITY_KEY_REF: 'zhudatuan/migration/identity',
      MIGRATION_PARTNER_KEY_REF: 'zhudatuan/migration/partner',
      MIGRATION_VOUCHER_KEY_REF: 'zhudatuan/migration/voucher',
      MIGRATION_SOURCE_SNAPSHOT_REF: 'zhudatuan/registration/empty-database-v1',
      KMS_ENDPOINT: 'https://127.0.0.1:8544',
      KMS_BEARER_TOKEN: kmsBearerToken,
      SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
      SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
    };
    expect(registrationMigrationEnvironment(environment).profile).toBe('registration-only');
    expect(registrationMigrationEnvironment({ ...environment,
      MIGRATION_DIRECTORY: '/opt/zhudatuan/releases/0123456789abcdef0123456789abcdef01234567-console-support/database/supabase/migrations',
    }).directory).toContain('/opt/zhudatuan/releases/');
    expect(() => registrationMigrationEnvironment({ ...environment, APP_ENV: 'test' }))
      .toThrow('REGISTRATION_MIGRATION_PRODUCTION_ENV_REQUIRED');
    expect(() => registrationMigrationEnvironment({ ...environment, MIGRATION_DIRECTORY: '/tmp/migrations' }))
      .toThrow('REGISTRATION_MIGRATION_DIRECTORY_INVALID');
    expect(() => registrationMigrationEnvironment({ ...environment, REDIS_CONNECTION_REF: 'legacy/redis' }))
      .toThrow('REGISTRATION_MIGRATION_KEY_FORBIDDEN:REDIS_CONNECTION_REF');
    expect(() => registrationMigrationEnvironment({ ...environment, KMS_BEARER_TOKEN: secretStoreBearerToken }))
      .toThrow('REGISTRATION_MIGRATION_WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  });

  it('accepts only the fail-closed registration API dependency allowlist', () => {
    const registration = {
      IDENTITY_REGISTRATION_API_PROFILE: 'registration-only',
      API_PORT: '4321',
      API_BIND_HOST: '127.0.0.1',
      APP_ENV: 'production',
      AUTH_MODE: 'membership',
      SERVICE_VERSION: '1.0.0',
      API_ALLOWED_ORIGINS: 'https://accounts.zhudatuan.com,https://console.zhudatuan.com,https://zhudatuan.com',
      AUTH_RETURN_TARGETS: '{"console":"https://console.zhudatuan.com","storefront":"https://zhudatuan.com","store":"https://console.zhudatuan.com/entrances/store","supplier":"https://console.zhudatuan.com/entrances/supplier"}',
      DATABASE_API_CONNECTION_REF: 'zhudatuan/database/api',
      SESSION_KEY_REF: 'zhudatuan/identity/session',
      IDENTITY_KEY_REF: 'zhudatuan/identity/index',
      KMS_ENDPOINT: 'https://127.0.0.1:8544',
      KMS_BEARER_TOKEN: kmsBearerToken,
      SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
      SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
    };
    expect(identityRegistrationApiEnvironment(registration).IDENTITY_REGISTRATION_API_PROFILE).toBe('registration-only');
    expect(() => identityRegistrationApiEnvironment({ ...registration, IDENTITY_REGISTRATION_API_PROFILE: 'full' }))
      .toThrow('IDENTITY_REGISTRATION_API_PROFILE_INVALID');
    expect(() => identityRegistrationApiEnvironment({ ...registration, REDIS_CONNECTION_REF: 'legacy/redis' }))
      .toThrow('IDENTITY_REGISTRATION_API_KEY_FORBIDDEN:REDIS_CONNECTION_REF');
    expect(() => identityRegistrationApiEnvironment({ ...registration, WECHAT_PAYMENT_CONFIG_REF: 'legacy/payment' }))
      .toThrow('IDENTITY_REGISTRATION_API_KEY_FORBIDDEN:WECHAT_PAYMENT_CONFIG_REF');
    expect(() => identityRegistrationApiEnvironment({ ...registration, API_BIND_HOST: '0.0.0.0' }))
      .toThrow('IDENTITY_REGISTRATION_API_BIND_HOST_INVALID');
    expect(() => identityRegistrationApiEnvironment({ ...registration,
      API_ALLOWED_ORIGINS: 'https://accounts.zhudatuan.com,https://console.zhudatuan.com' }))
      .toThrow('IDENTITY_REGISTRATION_API_ORIGINS_INVALID');
    expect(() => identityRegistrationApiEnvironment({ ...registration,
      API_ALLOWED_ORIGINS: `${registration.API_ALLOWED_ORIGINS},https://preview.zhudatuan.com` }))
      .toThrow('IDENTITY_REGISTRATION_API_ORIGINS_INVALID');
    expect(() => identityRegistrationApiEnvironment({ ...registration,
      AUTH_RETURN_TARGETS: '{"console":"https://console.zhudatuan.com","storefront":"https://preview.zhudatuan.com","store":"https://console.zhudatuan.com/entrances/store","supplier":"https://console.zhudatuan.com/entrances/supplier"}' }))
      .toThrow('IDENTITY_REGISTRATION_API_RETURN_TARGETS_INVALID');
    expect(() => identityRegistrationApiEnvironment({ ...registration, KMS_BEARER_TOKEN: secretStoreBearerToken }))
      .toThrow('WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  });

  it('validates local infrastructure and seed contracts without weakening production schemas', () => {
    const infrastructure = {
      LOCAL_TLS_KEY_FILE: '/private/local.key', LOCAL_TLS_CERT_FILE: '/private/local.crt', LOCAL_SECRETS_FILE: '/private/secrets.json',
      LOCAL_SECRETS_PORT: '8443', LOCAL_KMS_PORT: '8444', LOCAL_KMS_MASTER_KEY: 'local-master',
      LOCAL_SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken, LOCAL_KMS_BEARER_TOKEN: kmsBearerToken,
      LOCAL_OBJECTS_PORT: '8445', LOCAL_OBJECTS_DIRECTORY: '/private/objects', LOCAL_OBJECTS_TOKEN: 'local-object-token-value',
    };
    expect(localInfrastructureEnvironment(infrastructure).objectsPort).toBe(8445);
    expect(() => localInfrastructureEnvironment({ ...infrastructure, LOCAL_KMS_BEARER_TOKEN: secretStoreBearerToken }))
      .toThrow('LOCAL_WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
    const registrationOnly = {
      APP_ENV: 'production', LOCAL_RUNTIME_PROFILE: 'registration-only',
      LOCAL_TLS_KEY_FILE: infrastructure.LOCAL_TLS_KEY_FILE, LOCAL_TLS_CERT_FILE: infrastructure.LOCAL_TLS_CERT_FILE,
      LOCAL_SECRETS_FILE: infrastructure.LOCAL_SECRETS_FILE, LOCAL_SECRETS_PORT: infrastructure.LOCAL_SECRETS_PORT,
      LOCAL_KMS_PORT: infrastructure.LOCAL_KMS_PORT, LOCAL_KMS_MASTER_KEY: infrastructure.LOCAL_KMS_MASTER_KEY,
      LOCAL_SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken, LOCAL_KMS_BEARER_TOKEN: kmsBearerToken,
    };
    expect(localIdentityInfrastructureEnvironment(registrationOnly).secretStoreBearerToken).toBe(secretStoreBearerToken);
    expect(() => localIdentityInfrastructureEnvironment({ ...registrationOnly, LOCAL_OBJECTS_PORT: '8645' }))
      .toThrow('IDENTITY_INTERNAL_RUNTIME_KEY_FORBIDDEN:LOCAL_OBJECTS_PORT');
    expect(() => localIdentityInfrastructureEnvironment({
      APP_ENV: 'production', LOCAL_RUNTIME_PROFILE: 'registration-only',
      LOCAL_TLS_KEY_FILE: infrastructure.LOCAL_TLS_KEY_FILE, LOCAL_TLS_CERT_FILE: infrastructure.LOCAL_TLS_CERT_FILE,
      LOCAL_SECRETS_FILE: infrastructure.LOCAL_SECRETS_FILE, LOCAL_SECRET_STORE_BEARER_TOKEN: 'short',
      LOCAL_KMS_MASTER_KEY: infrastructure.LOCAL_KMS_MASTER_KEY, LOCAL_KMS_BEARER_TOKEN: kmsBearerToken,
    })).toThrow('LOCAL_SECRET_STORE_BEARER_TOKEN_INVALID');
    const fullStaging = {
      LOCAL_KMS_MASTER_KEY: infrastructure.LOCAL_KMS_MASTER_KEY,
      APP_ENV: 'production', LOCAL_RUNTIME_PROFILE: 'full-staging',
      LOCAL_TLS_KEY_FILE: '/opt/zhudatuan-staging-full/shared/tls/internal.key',
      LOCAL_TLS_CERT_FILE: '/opt/zhudatuan-staging-full/shared/tls/internal.crt',
      LOCAL_SECRETS_FILE: '/opt/zhudatuan-staging-full/shared/full-secrets.json',
      LOCAL_SECRETS_PORT: '8643', LOCAL_KMS_PORT: '8644',
      LOCAL_WORKLOAD_ACCESS_POLICY_FILE: '/opt/zhudatuan-staging-full/shared/full-internal-access.json',
      NODE_EXTRA_CA_CERTS: '/opt/zhudatuan-staging-full/shared/tls/internal-ca.crt',
      LOCAL_OBJECTS_PORT: '8645', LOCAL_OBJECTS_DIRECTORY: '/var/lib/zhudatuan-staging-full/objects',
      LOCAL_OBJECTS_TOKEN: objectsBearerToken,
    };
    expect(localInfrastructureEnvironment(fullStaging).objectsPort).toBe(8645);
    expect(localIdentityInfrastructureEnvironment(fullStaging).secretsPort).toBe(8643);
    expect(() => localInfrastructureEnvironment({ ...fullStaging, APP_ENV: 'test' }))
      .toThrow('FULL_STAGING_INTERNAL_RUNTIME_PRODUCTION_REQUIRED');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, LOCAL_OBJECTS_PORT: '8445' }))
      .toThrow('FULL_STAGING_OBJECTS_PORT_INVALID');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, LOCAL_OBJECTS_DIRECTORY: '/private/objects' }))
      .toThrow('FULL_STAGING_OBJECTS_DIRECTORY_INVALID');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, LOCAL_SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken }))
      .toThrow('FULL_STAGING_INTERNAL_RUNTIME_KEY_FORBIDDEN:LOCAL_SECRET_STORE_BEARER_TOKEN');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, LOCAL_SECRETS_PORT: '8443' }))
      .toThrow('FULL_STAGING_SECRETS_PORT_INVALID');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, LOCAL_KMS_PORT: '8444' }))
      .toThrow('FULL_STAGING_KMS_PORT_INVALID');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, LOCAL_SECRETS_FILE: '/opt/zhudatuan/shared/secrets.json' }))
      .toThrow('FULL_STAGING_SECRETS_FILE_INVALID');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, LOCAL_WORKLOAD_ACCESS_POLICY_FILE: '/opt/zhudatuan/shared/access.json' }))
      .toThrow('FULL_STAGING_WORKLOAD_ACCESS_POLICY_FILE_INVALID');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, NODE_EXTRA_CA_CERTS: '/opt/zhudatuan/shared/tls/ca.crt' }))
      .toThrow('FULL_STAGING_CA_FILE_INVALID');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, REDIS_PASSWORD: 'not-owned-here' }))
      .toThrow('FULL_STAGING_INTERNAL_RUNTIME_KEY_FORBIDDEN:REDIS_PASSWORD');
    const seed = {
      SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8443', LOCAL_ADMIN_DATABASE_CONNECTION_REF: 'shop/local/database/admin',
      SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
      MIGRATION_DATABASE_CONNECTION_REF: 'shop/local/database/migration',
      LOCAL_ETHAN_PASSWORD_REF: 'local/ethan/password', IDENTITY_KEY_REF: 'shop/local/identity/index',
      KMS_ENDPOINT: 'https://127.0.0.1:8444', OBJECT_STORE_ENDPOINT: 'https://127.0.0.1:8445', OBJECT_STORE_TOKEN_REF: 'shop/local/objects/api',
      KMS_BEARER_TOKEN: kmsBearerToken,
=======
import { describe, expect, it } from 'vitest';
=======
import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { clientEnvironment } from './ClientEnvironment';
import { miniappEnvironment } from './MiniappEnvironment';
import { API_ENVIRONMENT_KEYS, IDENTITY_REGISTRATION_API_ENVIRONMENT_KEYS, JOBS_ENVIRONMENT_KEYS, LOCAL_ENVIRONMENT_KEYS, REGISTRATION_MIGRATION_ENVIRONMENT_KEYS, WechatApplicationCatalog, apiBindHost, apiReturnTargets, bearerToken, identityRegistrationApiEnvironment, integerValue, isPrivateIpv4Host, jobRuntimeProfile, localIdentityInfrastructureEnvironment, localInfrastructureEnvironment, localSeedEnvironment, registrationMigrationEnvironment, requiredValue, validateApiEnvironment, validateJobsEnvironment } from './ServerEnvironment';

const secretStoreBearerToken = 's'.repeat(43);
const kmsBearerToken = 'k'.repeat(43);
const objectsBearerToken = 'o'.repeat(43);

describe('runtime configuration schema', () => {
  it('keeps the private CA trust path in every registration-only HTTPS client env', async () => {
    const expected = 'NODE_EXTRA_CA_CERTS=/opt/zhudatuan/shared/tls/internal-ca.crt';
    for (const file of ['identity-registration-api.env.example','identity-notification-jobs.env.example',
      'migration.env.example','registration-bootstrap.env.example','owner-bootstrap.env.example','purchase-api.env.example']) {
      const source = await readFile(new URL(`../../../infrastructure/zhudatuan/aliyun/${file}`, import.meta.url), 'utf8');
      expect(source.split(/\r?\n/).filter((line) => line.startsWith('NODE_EXTRA_CA_CERTS='))).toEqual([expected]);
    }
  });

  it('owns every shared key exactly once', () => {
    expect(new Set(API_ENVIRONMENT_KEYS).size).toBe(API_ENVIRONMENT_KEYS.length);
    expect(new Set(IDENTITY_REGISTRATION_API_ENVIRONMENT_KEYS).size).toBe(IDENTITY_REGISTRATION_API_ENVIRONMENT_KEYS.length);
    expect(new Set(JOBS_ENVIRONMENT_KEYS).size).toBe(JOBS_ENVIRONMENT_KEYS.length);
    expect(new Set(REGISTRATION_MIGRATION_ENVIRONMENT_KEYS).size).toBe(REGISTRATION_MIGRATION_ENVIRONMENT_KEYS.length);
    expect(new Set(Object.values(LOCAL_ENVIRONMENT_KEYS)).size).toBe(Object.values(LOCAL_ENVIRONMENT_KEYS).length);
  });

  it('isolates strict registration migration settings from the generic migration environment', () => {
    const environment = {
      APP_ENV: 'production',
      REGISTRATION_MIGRATION_PROFILE: 'registration-only',
      MIGRATION_APPROVAL: 'hard-cut-20260821054000',
      MIGRATION_DATABASE_CONNECTION_REF: 'zhudatuan/registration/database/migration',
      MIGRATION_DIRECTORY: '/opt/zhudatuan/current/database/supabase/migrations',
      MIGRATION_DISTRIBUTOR_KEY_REF: 'zhudatuan/migration/distributor',
      MIGRATION_IDENTITY_KEY_REF: 'zhudatuan/migration/identity',
      MIGRATION_PARTNER_KEY_REF: 'zhudatuan/migration/partner',
      MIGRATION_VOUCHER_KEY_REF: 'zhudatuan/migration/voucher',
      MIGRATION_SOURCE_SNAPSHOT_REF: 'zhudatuan/registration/empty-database-v1',
      KMS_ENDPOINT: 'https://127.0.0.1:8544',
      KMS_BEARER_TOKEN: kmsBearerToken,
      SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
      SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
    };
    expect(registrationMigrationEnvironment(environment).profile).toBe('registration-only');
    expect(registrationMigrationEnvironment({ ...environment,
      MIGRATION_DIRECTORY: '/opt/zhudatuan/releases/0123456789abcdef0123456789abcdef01234567-console-support/database/supabase/migrations',
    }).directory).toContain('/opt/zhudatuan/releases/');
    expect(() => registrationMigrationEnvironment({ ...environment, APP_ENV: 'test' }))
      .toThrow('REGISTRATION_MIGRATION_PRODUCTION_ENV_REQUIRED');
    expect(() => registrationMigrationEnvironment({ ...environment, MIGRATION_DIRECTORY: '/tmp/migrations' }))
      .toThrow('REGISTRATION_MIGRATION_DIRECTORY_INVALID');
    expect(() => registrationMigrationEnvironment({ ...environment, REDIS_CONNECTION_REF: 'legacy/redis' }))
      .toThrow('REGISTRATION_MIGRATION_KEY_FORBIDDEN:REDIS_CONNECTION_REF');
    expect(() => registrationMigrationEnvironment({ ...environment, KMS_BEARER_TOKEN: secretStoreBearerToken }))
      .toThrow('REGISTRATION_MIGRATION_WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  });

  it('accepts only the fail-closed registration API dependency allowlist', () => {
    const registration = {
      IDENTITY_REGISTRATION_API_PROFILE: 'registration-only',
      API_PORT: '4321',
      API_BIND_HOST: '127.0.0.1',
      APP_ENV: 'production',
      AUTH_MODE: 'membership',
      SERVICE_VERSION: '1.0.0',
      API_ALLOWED_ORIGINS: 'https://accounts.zhudatuan.com,https://console.zhudatuan.com,https://zhudatuan.com',
      AUTH_RETURN_TARGETS: '{"console":"https://console.zhudatuan.com","storefront":"https://zhudatuan.com","store":"https://console.zhudatuan.com/entrances/store","supplier":"https://console.zhudatuan.com/entrances/supplier"}',
      DATABASE_API_CONNECTION_REF: 'zhudatuan/database/api',
      SESSION_KEY_REF: 'zhudatuan/identity/session',
      IDENTITY_KEY_REF: 'zhudatuan/identity/index',
      KMS_ENDPOINT: 'https://127.0.0.1:8544',
      KMS_BEARER_TOKEN: kmsBearerToken,
      SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8543',
      SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
    };
    expect(identityRegistrationApiEnvironment(registration).IDENTITY_REGISTRATION_API_PROFILE).toBe('registration-only');
    expect(() => identityRegistrationApiEnvironment({ ...registration, IDENTITY_REGISTRATION_API_PROFILE: 'full' }))
      .toThrow('IDENTITY_REGISTRATION_API_PROFILE_INVALID');
    expect(() => identityRegistrationApiEnvironment({ ...registration, REDIS_CONNECTION_REF: 'legacy/redis' }))
      .toThrow('IDENTITY_REGISTRATION_API_KEY_FORBIDDEN:REDIS_CONNECTION_REF');
    expect(() => identityRegistrationApiEnvironment({ ...registration, WECHAT_PAYMENT_CONFIG_REF: 'legacy/payment' }))
      .toThrow('IDENTITY_REGISTRATION_API_KEY_FORBIDDEN:WECHAT_PAYMENT_CONFIG_REF');
    expect(() => identityRegistrationApiEnvironment({ ...registration, API_BIND_HOST: '0.0.0.0' }))
      .toThrow('IDENTITY_REGISTRATION_API_BIND_HOST_INVALID');
    expect(() => identityRegistrationApiEnvironment({ ...registration,
      API_ALLOWED_ORIGINS: 'https://accounts.zhudatuan.com,https://console.zhudatuan.com' }))
      .toThrow('IDENTITY_REGISTRATION_API_ORIGINS_INVALID');
    expect(() => identityRegistrationApiEnvironment({ ...registration,
      API_ALLOWED_ORIGINS: `${registration.API_ALLOWED_ORIGINS},https://preview.zhudatuan.com` }))
      .toThrow('IDENTITY_REGISTRATION_API_ORIGINS_INVALID');
    expect(() => identityRegistrationApiEnvironment({ ...registration,
      AUTH_RETURN_TARGETS: '{"console":"https://console.zhudatuan.com","storefront":"https://preview.zhudatuan.com","store":"https://console.zhudatuan.com/entrances/store","supplier":"https://console.zhudatuan.com/entrances/supplier"}' }))
      .toThrow('IDENTITY_REGISTRATION_API_RETURN_TARGETS_INVALID');
    expect(() => identityRegistrationApiEnvironment({ ...registration, KMS_BEARER_TOKEN: secretStoreBearerToken }))
      .toThrow('WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  });

  it('validates local infrastructure and seed contracts without weakening production schemas', () => {
    const infrastructure = {
      LOCAL_TLS_KEY_FILE: '/private/local.key', LOCAL_TLS_CERT_FILE: '/private/local.crt', LOCAL_SECRETS_FILE: '/private/secrets.json',
      LOCAL_SECRETS_PORT: '8443', LOCAL_KMS_PORT: '8444', LOCAL_KMS_MASTER_KEY: 'local-master',
      LOCAL_SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken, LOCAL_KMS_BEARER_TOKEN: kmsBearerToken,
      LOCAL_OBJECTS_PORT: '8445', LOCAL_OBJECTS_DIRECTORY: '/private/objects', LOCAL_OBJECTS_TOKEN: 'local-object-token-value',
    };
    expect(localInfrastructureEnvironment(infrastructure).objectsPort).toBe(8445);
    expect(() => localInfrastructureEnvironment({ ...infrastructure, LOCAL_KMS_BEARER_TOKEN: secretStoreBearerToken }))
      .toThrow('LOCAL_WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
    const registrationOnly = {
      APP_ENV: 'production', LOCAL_RUNTIME_PROFILE: 'registration-only',
      LOCAL_TLS_KEY_FILE: infrastructure.LOCAL_TLS_KEY_FILE, LOCAL_TLS_CERT_FILE: infrastructure.LOCAL_TLS_CERT_FILE,
      LOCAL_SECRETS_FILE: infrastructure.LOCAL_SECRETS_FILE, LOCAL_SECRETS_PORT: infrastructure.LOCAL_SECRETS_PORT,
      LOCAL_KMS_PORT: infrastructure.LOCAL_KMS_PORT, LOCAL_KMS_MASTER_KEY: infrastructure.LOCAL_KMS_MASTER_KEY,
      LOCAL_SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken, LOCAL_KMS_BEARER_TOKEN: kmsBearerToken,
    };
    expect(localIdentityInfrastructureEnvironment(registrationOnly).secretStoreBearerToken).toBe(secretStoreBearerToken);
    expect(() => localIdentityInfrastructureEnvironment({ ...registrationOnly, LOCAL_OBJECTS_PORT: '8645' }))
      .toThrow('IDENTITY_INTERNAL_RUNTIME_KEY_FORBIDDEN:LOCAL_OBJECTS_PORT');
    expect(() => localIdentityInfrastructureEnvironment({
      APP_ENV: 'production', LOCAL_RUNTIME_PROFILE: 'registration-only',
      LOCAL_TLS_KEY_FILE: infrastructure.LOCAL_TLS_KEY_FILE, LOCAL_TLS_CERT_FILE: infrastructure.LOCAL_TLS_CERT_FILE,
      LOCAL_SECRETS_FILE: infrastructure.LOCAL_SECRETS_FILE, LOCAL_SECRET_STORE_BEARER_TOKEN: 'short',
      LOCAL_KMS_MASTER_KEY: infrastructure.LOCAL_KMS_MASTER_KEY, LOCAL_KMS_BEARER_TOKEN: kmsBearerToken,
    })).toThrow('LOCAL_SECRET_STORE_BEARER_TOKEN_INVALID');
    const fullStaging = {
      LOCAL_KMS_MASTER_KEY: infrastructure.LOCAL_KMS_MASTER_KEY,
      APP_ENV: 'production', LOCAL_RUNTIME_PROFILE: 'full-staging',
      LOCAL_TLS_KEY_FILE: '/opt/zhudatuan-staging-full/shared/tls/internal.key',
      LOCAL_TLS_CERT_FILE: '/opt/zhudatuan-staging-full/shared/tls/internal.crt',
      LOCAL_SECRETS_FILE: '/opt/zhudatuan-staging-full/shared/full-secrets.json',
      LOCAL_SECRETS_PORT: '8643', LOCAL_KMS_PORT: '8644',
      LOCAL_WORKLOAD_ACCESS_POLICY_FILE: '/opt/zhudatuan-staging-full/shared/full-internal-access.json',
      NODE_EXTRA_CA_CERTS: '/opt/zhudatuan-staging-full/shared/tls/internal-ca.crt',
      LOCAL_OBJECTS_PORT: '8645', LOCAL_OBJECTS_DIRECTORY: '/var/lib/zhudatuan-staging-full/objects',
      LOCAL_OBJECTS_TOKEN: objectsBearerToken,
    };
    expect(localInfrastructureEnvironment(fullStaging).objectsPort).toBe(8645);
    expect(localIdentityInfrastructureEnvironment(fullStaging).secretsPort).toBe(8643);
    expect(() => localInfrastructureEnvironment({ ...fullStaging, APP_ENV: 'test' }))
      .toThrow('FULL_STAGING_INTERNAL_RUNTIME_PRODUCTION_REQUIRED');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, LOCAL_OBJECTS_PORT: '8445' }))
      .toThrow('FULL_STAGING_OBJECTS_PORT_INVALID');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, LOCAL_OBJECTS_DIRECTORY: '/private/objects' }))
      .toThrow('FULL_STAGING_OBJECTS_DIRECTORY_INVALID');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, LOCAL_SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken }))
      .toThrow('FULL_STAGING_INTERNAL_RUNTIME_KEY_FORBIDDEN:LOCAL_SECRET_STORE_BEARER_TOKEN');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, LOCAL_SECRETS_PORT: '8443' }))
      .toThrow('FULL_STAGING_SECRETS_PORT_INVALID');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, LOCAL_KMS_PORT: '8444' }))
      .toThrow('FULL_STAGING_KMS_PORT_INVALID');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, LOCAL_SECRETS_FILE: '/opt/zhudatuan/shared/secrets.json' }))
      .toThrow('FULL_STAGING_SECRETS_FILE_INVALID');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, LOCAL_WORKLOAD_ACCESS_POLICY_FILE: '/opt/zhudatuan/shared/access.json' }))
      .toThrow('FULL_STAGING_WORKLOAD_ACCESS_POLICY_FILE_INVALID');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, NODE_EXTRA_CA_CERTS: '/opt/zhudatuan/shared/tls/ca.crt' }))
      .toThrow('FULL_STAGING_CA_FILE_INVALID');
    expect(() => localInfrastructureEnvironment({ ...fullStaging, REDIS_PASSWORD: 'not-owned-here' }))
      .toThrow('FULL_STAGING_INTERNAL_RUNTIME_KEY_FORBIDDEN:REDIS_PASSWORD');
    const seed = {
      SECRET_STORE_ENDPOINT: 'https://127.0.0.1:8443', LOCAL_ADMIN_DATABASE_CONNECTION_REF: 'shop/local/database/admin',
      SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
      MIGRATION_DATABASE_CONNECTION_REF: 'shop/local/database/migration',
      LOCAL_ETHAN_PASSWORD_REF: 'local/ethan/password', IDENTITY_KEY_REF: 'shop/local/identity/index',
      KMS_ENDPOINT: 'https://127.0.0.1:8444', OBJECT_STORE_ENDPOINT: 'https://127.0.0.1:8445', OBJECT_STORE_TOKEN_REF: 'shop/local/objects/api',
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      KMS_BEARER_TOKEN: kmsBearerToken,
>>>>>>> 018b2a71 (chore(release): capture current production source)
    };
    expect(localSeedEnvironment(seed).adminDatabaseConnectionRef).toBe('shop/local/database/admin');
    expect(localSeedEnvironment(seed).migrationDatabaseConnectionRef).toBe('shop/local/database/migration');
    expect(() => localSeedEnvironment({ ...seed, KMS_ENDPOINT: 'http://127.0.0.1:8444' })).toThrow('KMS_ENDPOINT_INVALID');
  });

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  it('requires the internal-runtime systemd credential paths in a live full-staging process', () => {
    const credentials = '/run/credentials/zhudatuan-staging-full-internal-runtime.service';
    const live = {
      APP_ENV: 'production', LOCAL_RUNTIME_PROFILE: 'full-staging',
      LOCAL_TLS_KEY_FILE: `${credentials}/internal-tls-key`,
      LOCAL_TLS_CERT_FILE: `${credentials}/internal-tls-certificate`,
      LOCAL_SECRETS_FILE: `${credentials}/secrets-catalog`,
      LOCAL_SECRETS_PORT: '8643', LOCAL_KMS_PORT: '8644', LOCAL_KMS_MASTER_KEY: 'local-master',
      LOCAL_WORKLOAD_ACCESS_POLICY_FILE: `${credentials}/workload-access-policy`,
      NODE_EXTRA_CA_CERTS: `${credentials}/internal-ca-certificate`,
      LOCAL_OBJECTS_PORT: '8645', LOCAL_OBJECTS_DIRECTORY: '/var/lib/zhudatuan-staging-full/objects',
      LOCAL_OBJECTS_TOKEN: objectsBearerToken,
    };
    try {
      for (const [key, value] of Object.entries(live)) vi.stubEnv(key, value);
      expect(localInfrastructureEnvironment().secretsFile).toBe(`${credentials}/secrets-catalog`);
      expect(localIdentityInfrastructureEnvironment().tlsKeyFile).toBe(`${credentials}/internal-tls-key`);
      for (const [key, sourcePath, code] of [
        ['LOCAL_TLS_KEY_FILE', '/opt/zhudatuan-staging-full/shared/tls/internal.key', 'FULL_STAGING_TLS_KEY_FILE_INVALID'],
        ['LOCAL_TLS_CERT_FILE', '/opt/zhudatuan-staging-full/shared/tls/internal.crt', 'FULL_STAGING_TLS_CERTIFICATE_FILE_INVALID'],
        ['LOCAL_SECRETS_FILE', '/opt/zhudatuan-staging-full/shared/full-secrets.json', 'FULL_STAGING_SECRETS_FILE_INVALID'],
        ['LOCAL_WORKLOAD_ACCESS_POLICY_FILE', '/opt/zhudatuan-staging-full/shared/full-internal-access.json', 'FULL_STAGING_WORKLOAD_ACCESS_POLICY_FILE_INVALID'],
        ['NODE_EXTRA_CA_CERTS', '/opt/zhudatuan-staging-full/shared/tls/internal-ca.crt', 'FULL_STAGING_CA_FILE_INVALID'],
      ] as const) {
        vi.stubEnv(key, sourcePath);
        expect(() => localInfrastructureEnvironment()).toThrow(code);
        vi.stubEnv(key, live[key]);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('normalizes required values and rejects blank secrets', () => {
    expect(requiredValue(' value ', 'MISSING')).toBe('value');
    expect(() => requiredValue('   ', 'MISSING')).toThrow('MISSING');
    expect(bearerToken(` ${secretStoreBearerToken} `, 'INVALID')).toBe(secretStoreBearerToken);
    expect(() => bearerToken('x'.repeat(41), 'INVALID')).toThrow('INVALID');
    expect(() => bearerToken(`${'x'.repeat(43)}+`, 'INVALID')).toThrow('INVALID');
<<<<<<< HEAD
=======
  it('normalizes required values and rejects blank secrets', () => {
    expect(requiredValue(' value ', 'MISSING')).toBe('value');
    expect(() => requiredValue('   ', 'MISSING')).toThrow('MISSING');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  });

  it('accepts only bounded integer configuration', () => {
    expect(integerValue(undefined, 10, 1, 20, 'INVALID')).toBe(10);
    expect(integerValue('20', 10, 1, 20, 'INVALID')).toBe(20);
    expect(() => integerValue('20.5', 10, 1, 20, 'INVALID')).toThrow('INVALID');
  });

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  it('binds the API to loopback by default and only permits an explicit container bind', () => {
    expect(apiBindHost({})).toBe('127.0.0.1');
    expect(apiBindHost({ API_BIND_HOST: '0.0.0.0' })).toBe('0.0.0.0');
    expect(() => apiBindHost({ API_BIND_HOST: '::' })).toThrow('API_BIND_HOST_INVALID');
    expect(() => apiBindHost({ API_BIND_HOST: '203.0.113.10' })).toThrow('API_BIND_HOST_INVALID');
  });

  it('requires an explicit Jobs profile and accepts only the identity notification dependency allowlist', () => {
    const identity = {
      APP_ENV: 'production',
      SERVICE_VERSION: '1.0.0',
      JOB_RUNTIME_PROFILE: 'identity-notification-only',
      DATABASE_JOB_CONNECTION_REF: 'secret/database/jobs',
      SECRET_STORE_ENDPOINT: 'https://secrets.internal',
      SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
      KMS_ENDPOINT: 'https://kms.internal',
      KMS_BEARER_TOKEN: kmsBearerToken,
      IDENTITY_NOTIFICATION_CONFIG_REF: 'secret/notification/identity-sms',
      JOB_WORKER_ID: 'identity-notification-1',
    };
    expect(jobRuntimeProfile(identity)).toBe('identity-notification-only');
    expect(() => validateJobsEnvironment(identity)).not.toThrow();
    expect(() => validateJobsEnvironment({ ...identity, JOB_RUNTIME_PROFILE: undefined })).toThrow('JOB_RUNTIME_PROFILE_INVALID');
    expect(() => validateJobsEnvironment({ ...identity, JOB_RUNTIME_PROFILE: 'notifications' })).toThrow('JOB_RUNTIME_PROFILE_INVALID');
    expect(() => validateJobsEnvironment({ ...identity, WECHAT_PAYMENT_CONFIG_REF: 'secret/payment/wechat' }))
      .toThrow('JOB_RUNTIME_PROFILE_KEY_FORBIDDEN:WECHAT_PAYMENT_CONFIG_REF');
    expect(() => validateJobsEnvironment({ ...identity, NOTIFICATION_CONFIG_REF: 'secret/notification/full' }))
      .toThrow('JOB_RUNTIME_PROFILE_KEY_FORBIDDEN:NOTIFICATION_CONFIG_REF');
    expect(() => validateJobsEnvironment({ ...identity, PAYMENT_CONFIG_REF: 'secret/payment/unknown' }))
      .toThrow('JOB_RUNTIME_PROFILE_KEY_FORBIDDEN:PAYMENT_CONFIG_REF');
    expect(() => validateJobsEnvironment({ ...identity, KMS_BEARER_TOKEN: secretStoreBearerToken }))
      .toThrow('WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
  });

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  it('fails closed for incomplete browser, storefront, and miniapp deployment identity', () => {
    const client = { VITE_API_BASE_URL: 'https://api.example.com', VITE_AUTH_BASE_URL: 'https://auth.example.com', VITE_CLIENT_VERSION: '2.4.1' };
    expect(clientEnvironment(client).clientVersion).toBe('2.4.1');
    expect(() => clientEnvironment({ ...client, VITE_CLIENT_VERSION: '' })).toThrow('CLIENT_VERSION_MISSING');
    expect(() => clientEnvironment({ NEXT_PUBLIC_API_BASE_URL: 'https://api.example.com', NEXT_PUBLIC_AUTH_BASE_URL: 'https://auth.example.com', NEXT_PUBLIC_CLIENT_VERSION: '2.4.1' })).toThrow('CLIENT_API_BASE_URL_MISSING');
    expect(() => miniappEnvironment({ apiBaseUrl: 'https://api.example.com', mallId: '', clientVersion: '2.4.1' })).toThrow('MINIAPP_MALL_ID_INVALID');
  });

  it('fails startup on an unsafe production identity or secret schema', () => {
    const valid = {
      APP_ENV: 'production',
      AUTH_MODE: 'membership',
      SERVICE_VERSION: '1.0.0',
      API_ALLOWED_ORIGINS: 'https://console.example.com',
      AUTH_RETURN_TARGETS: '{"console":"https://console.example.com","storefront":"https://storefront.example.com","store":"https://store.example.com","supplier":"https://supplier.example.com"}',
      DATABASE_API_CONNECTION_REF: 'secret/database/api',
      REDIS_CONNECTION_REF: 'secret/redis/query',
      SESSION_KEY_REF: 'secret/session/signing',
      IDENTITY_KEY_REF: 'secret/identity/lookup',
      QUOTE_KEY_REF: 'secret/checkout/quote',
      KMS_ENDPOINT: 'https://kms.internal',
<<<<<<< HEAD
<<<<<<< HEAD
      KMS_BEARER_TOKEN: kmsBearerToken,
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      KMS_BEARER_TOKEN: kmsBearerToken,
>>>>>>> 018b2a71 (chore(release): capture current production source)
      PII_KEY_REF: 'secret/pii/encryption',
      WECHAT_APPLICATION_CONFIG_REF: 'secret/wechat/applications',
      WECHAT_PAYMENT_CONFIG_REF: 'secret/payment/wechat',
      WECHAT_IDENTITY_CONFIG_REF: 'secret/identity/wechat',
      OBJECT_STORE_ENDPOINT: 'https://objects.internal',
      OBJECT_STORE_TOKEN_REF: 'secret/objects/token',
      EXTENSION_MANIFEST_KEY_REF: 'secret/extensions/manifestkey',
      SECRET_STORE_ENDPOINT: 'https://secrets.internal',
<<<<<<< HEAD
<<<<<<< HEAD
      SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      SECRET_STORE_BEARER_TOKEN: secretStoreBearerToken,
>>>>>>> 018b2a71 (chore(release): capture current production source)
    };
    expect(() => validateApiEnvironment(valid)).not.toThrow();
    expect(() => validateApiEnvironment({ ...valid, AUTH_MODE: 'test' })).toThrow('PRODUCTION_AUTH_MODE_INVALID');
    expect(() => validateApiEnvironment({ ...valid, DATABASE_API_CONNECTION_REF: '' })).toThrow('DATABASE_API_CONNECTION_REF_MISSING');
    expect(() => validateApiEnvironment({ ...valid, SECRET_STORE_ENDPOINT: '' })).toThrow('SECRET_STORE_ENDPOINT_MISSING');
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    expect(() => validateApiEnvironment({ ...valid, SECRET_STORE_BEARER_TOKEN: 'short' })).toThrow('SECRET_STORE_BEARER_TOKEN_INVALID');
    expect(() => validateApiEnvironment({ ...valid, KMS_BEARER_TOKEN: '!' + 'k'.repeat(43) })).toThrow('KMS_BEARER_TOKEN_INVALID');
    expect(() => validateApiEnvironment({ ...valid, KMS_BEARER_TOKEN: secretStoreBearerToken }))
      .toThrow('WORKLOAD_BEARER_TOKENS_MUST_DIFFER');
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    expect(apiReturnTargets(valid).storefront).toBe('https://storefront.example.com');
    expect(() => apiReturnTargets({ ...valid, AUTH_RETURN_TARGETS: '{"storefront":"https://evil.example.com"}' })).toThrow('AUTH_RETURN_TARGETS_INVALID');
  });

  it('owns both WeChat application identities once and rejects duplicates', () => {
    const catalog = WechatApplicationCatalog.parse({ applications: [
      { scene: 'miniapp', appId: 'wx4df4137881a1d2bc' },
      { scene: 'jsapi', appId: 'wx4df4137881a1d2bd' },
    ] });
    expect(catalog.get('jsapi').appId).toBe('wx4df4137881a1d2bd');
    expect(catalog.find('wx4df4137881a1d2bc')?.scene).toBe('miniapp');
    expect(() => WechatApplicationCatalog.parse({ applications: [
      { scene: 'miniapp', appId: 'wx4df4137881a1d2bc' },
      { scene: 'jsapi', appId: 'wx4df4137881a1d2bc' },
    ] })).toThrow('WECHAT_APPLICATION_CONFIG_INVALID');
  });

  it('classifies only literal private or local IPv4 hosts', () => {
    expect(['10.0.0.1', '127.0.0.1', '169.254.1.1', '172.16.0.1', '172.31.255.255', '192.168.1.1'].every(isPrivateIpv4Host)).toBe(true);
    expect(['8.8.8.8', '172.15.0.1', '172.32.0.1', 'api.example.com'].some(isPrivateIpv4Host)).toBe(false);
  });
});
