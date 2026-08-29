import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { identityRegistrationApiEnvironment, localIdentityInfrastructureEnvironment, migrationEnvironment, validateJobsEnvironment, type EnvironmentSource } from '@shop/config/server';
import { stagingOwnerBootstrapEnvironment } from '../../../../tools/seed/src/StagingOwnerBootstrapPlan';

const directory = dirname(fileURLToPath(import.meta.url));
const environment = (name: string): Record<string, string> => parseEnvironment(readFileSync(resolve(directory, name), 'utf8'));

const identityApi = {
  ...environment('identity-registration-api.env.example'),
  APP_ENV: 'test',
  AUTH_MODE: 'membership',
  IDENTITY_REGISTRATION_API_PROFILE: 'registration-only',
  API_PORT: '4421',
  API_BIND_HOST: '127.0.0.1',
};
const identityJobs = {
  ...environment('identity-notification-jobs.env.example'),
  APP_ENV: 'production',
  JOB_RUNTIME_PROFILE: 'identity-notification-only',
};
const fullApi = {
  ...environment('full-identity-registration-api.env.example'),
  APP_ENV: 'test',
  AUTH_MODE: 'membership',
  IDENTITY_REGISTRATION_API_PROFILE: 'registration-only',
  API_PORT: '4431',
  API_BIND_HOST: '127.0.0.1',
};
const fullJobs = {
  ...environment('full-jobs.env.example'),
  APP_ENV: 'production',
  JOB_RUNTIME_PROFILE: 'full',
};
const internalRuntime = {
  ...environment('full-internal-runtime.env.example'),
  APP_ENV: 'production',
  LOCAL_RUNTIME_PROFILE: 'registration-only',
};
const migration = environment('full-migration.env.example');
const owner = environment('full-owner-bootstrap.env.example');

identityRegistrationApiEnvironment(identityApi);
validateJobsEnvironment(identityJobs);
identityRegistrationApiEnvironment(fullApi);
validateJobsEnvironment(fullJobs);
localIdentityInfrastructureEnvironment(internalRuntime);
migrationEnvironment(migration);
stagingOwnerBootstrapEnvironment(owner);

assertMissingFails(
  identityApi,
  [
    'APP_ENV',
    'AUTH_MODE',
    'IDENTITY_REGISTRATION_API_PROFILE',
    'SERVICE_VERSION',
    'API_ALLOWED_ORIGINS',
    'AUTH_RETURN_TARGETS',
    'DATABASE_API_CONNECTION_REF',
    'SESSION_KEY_REF',
    'IDENTITY_KEY_REF',
    'SECRET_STORE_ENDPOINT',
    'SECRET_STORE_BEARER_TOKEN',
    'KMS_ENDPOINT',
    'KMS_BEARER_TOKEN',
  ],
  (source) => identityRegistrationApiEnvironment(source)
);
assertMissingFails(
  identityJobs,
  ['APP_ENV', 'JOB_RUNTIME_PROFILE', 'SERVICE_VERSION', 'DATABASE_JOB_CONNECTION_REF', 'SECRET_STORE_ENDPOINT', 'SECRET_STORE_BEARER_TOKEN', 'KMS_ENDPOINT', 'KMS_BEARER_TOKEN', 'IDENTITY_NOTIFICATION_CONFIG_REF', 'JOB_WORKER_ID'],
  validateJobsEnvironment
);
assertMissingFails(
  fullApi,
  [
    'APP_ENV',
    'AUTH_MODE',
    'IDENTITY_REGISTRATION_API_PROFILE',
    'SERVICE_VERSION',
    'API_ALLOWED_ORIGINS',
    'AUTH_RETURN_TARGETS',
    'DATABASE_API_CONNECTION_REF',
    'SESSION_KEY_REF',
    'IDENTITY_KEY_REF',
    'SECRET_STORE_ENDPOINT',
    'SECRET_STORE_BEARER_TOKEN',
    'KMS_ENDPOINT',
    'KMS_BEARER_TOKEN',
  ],
  (source) => identityRegistrationApiEnvironment(source)
);
assertMissingFails(
  fullJobs,
  [
    'APP_ENV',
    'JOB_RUNTIME_PROFILE',
    'SERVICE_VERSION',
    'DATABASE_JOB_CONNECTION_REF',
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
    'OBJECT_STORE_ENDPOINT',
    'OBJECT_STORE_TOKEN_REF',
    'JOB_WORKER_ID',
  ],
  validateJobsEnvironment
);
assertMissingFails(
  internalRuntime,
  ['APP_ENV', 'LOCAL_TLS_KEY_FILE', 'LOCAL_TLS_CERT_FILE', 'LOCAL_SECRETS_FILE', 'LOCAL_KMS_MASTER_KEY', 'LOCAL_SECRET_STORE_BEARER_TOKEN', 'LOCAL_KMS_BEARER_TOKEN'],
  localIdentityInfrastructureEnvironment
);
assertMissingFails(
  migration,
  [
    'MIGRATION_APPROVAL',
    'MIGRATION_DATABASE_CONNECTION_REF',
    'MIGRATION_DIRECTORY',
    'MIGRATION_DISTRIBUTOR_KEY_REF',
    'MIGRATION_IDENTITY_KEY_REF',
    'MIGRATION_PARTNER_KEY_REF',
    'MIGRATION_VOUCHER_KEY_REF',
    'MIGRATION_SOURCE_SNAPSHOT_REF',
    'KMS_ENDPOINT',
    'KMS_BEARER_TOKEN',
    'SECRET_STORE_ENDPOINT',
    'SECRET_STORE_BEARER_TOKEN',
  ],
  migrationEnvironment
);
assertMissingFails(
  owner,
  [
    'APP_ENV',
    'ZHUDATUAN_OWNER_BOOTSTRAP_CONFIRM',
    'ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_URL',
    'ZHUDATUAN_OWNER_BOOTSTRAP_DATABASE_NAME',
    'ZHUDATUAN_OWNER_BOOTSTRAP_SENTINEL',
    'ZHUDATUAN_OWNER_PASSWORD_REF',
    'ZHUDATUAN_OWNER_BOOTSTRAP_RECEIPT_REF',
    'IDENTITY_KEY_REF',
    'SECRET_STORE_ENDPOINT',
    'SECRET_STORE_BEARER_TOKEN',
  ],
  (source) => stagingOwnerBootstrapEnvironment(source as NodeJS.ProcessEnv)
);

assert.throws(() => validateJobsEnvironment({ ...fullJobs, IDENTITY_NOTIFICATION_CONFIG_REF: 'forbidden/in/full' }), /JOB_RUNTIME_PROFILE_KEY_FORBIDDEN:IDENTITY_NOTIFICATION_CONFIG_REF/);
assert.throws(() => validateJobsEnvironment({ ...identityJobs, REDIS_CONNECTION_REF: 'forbidden/in/identity' }), /JOB_RUNTIME_PROFILE_KEY_FORBIDDEN:REDIS_CONNECTION_REF/);
assert.equal(fullApi.SECRET_STORE_BEARER_TOKEN, internalRuntime.LOCAL_SECRET_STORE_BEARER_TOKEN);
assert.equal(fullJobs.SECRET_STORE_BEARER_TOKEN, internalRuntime.LOCAL_SECRET_STORE_BEARER_TOKEN);
assert.equal(migration.SECRET_STORE_BEARER_TOKEN, internalRuntime.LOCAL_SECRET_STORE_BEARER_TOKEN);
assert.equal(owner.SECRET_STORE_BEARER_TOKEN, internalRuntime.LOCAL_SECRET_STORE_BEARER_TOKEN);
assert.equal(fullApi.KMS_BEARER_TOKEN, internalRuntime.LOCAL_KMS_BEARER_TOKEN);
assert.equal(fullJobs.KMS_BEARER_TOKEN, internalRuntime.LOCAL_KMS_BEARER_TOKEN);
assert.equal(migration.KMS_BEARER_TOKEN, internalRuntime.LOCAL_KMS_BEARER_TOKEN);
assert.notEqual(internalRuntime.LOCAL_SECRET_STORE_BEARER_TOKEN, internalRuntime.LOCAL_KMS_BEARER_TOKEN);

process.stdout.write('Both staging profile environment validators passed and fail closed on missing required values.\n');

function assertMissingFails(source: Readonly<Record<string, string>>, keys: readonly string[], validate: (candidate: EnvironmentSource) => unknown): void {
  for (const key of keys) {
    const candidate = { ...source };
    delete candidate[key];
    assert.throws(() => validate(candidate), undefined, `missing ${key} did not fail closed`);
  }
}

function parseEnvironment(source: string): Record<string, string> {
  return Object.fromEntries(
    source.split(/\r?\n/u).flatMap((line) => {
      const candidate = line.trim();
      if (!candidate || candidate.startsWith('#')) return [];
      const separator = candidate.indexOf('=');
      assert.ok(separator > 0, `invalid environment line: ${candidate}`);
      const key = candidate.slice(0, separator);
      let value = candidate.slice(separator + 1);
      if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) value = value.slice(1, -1);
      return [[key, value]];
    })
  );
}
