import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const processConfig = require(resolve(directory, 'ecosystem.config.cjs'));
const caddy = await readFile(resolve(directory, 'Caddyfile'), 'utf8');
const delivery = await readFile(resolve(directory, 'delivery.yml'), 'utf8');
const apiEnvironment = parseEnvironment(await readFile(resolve(directory, 'identity-registration-api.env.example'), 'utf8'));
const jobsEnvironment = parseEnvironment(await readFile(resolve(directory, 'identity-notification-jobs.env.example'), 'utf8'));
const deploymentSources = `${caddy}\n${delivery}`;

assert.deepEqual(processConfig.apps.map(({ name }) => name).sort(), [
  'zhudatuan-staging-identity-api',
  'zhudatuan-staging-identity-notification-jobs',
]);

const byName = new Map(processConfig.apps.map((application) => [application.name, application]));
const api = byName.get('zhudatuan-staging-identity-api');
const jobs = byName.get('zhudatuan-staging-identity-notification-jobs');
assert.ok(api.args.includes('services/commerce/dist/IdentityRegistrationApiMain.js'));
assert.ok(api.args.includes('IDENTITY_REGISTRATION_API_PROFILE=registration-only'));
assert.ok(api.args.includes('APP_ENV=test'));
assert.ok(api.args.includes('API_PORT=4421'));
assert.ok(jobs.args.includes('services/commerce/dist/IdentityNotificationJobsOnlyMain.js'));
assert.ok(jobs.args.includes('JOB_RUNTIME_PROFILE=identity-notification-only'));
assert.ok(jobs.args.includes('APP_ENV=production'));

for (const application of processConfig.apps) {
  assert.equal(application.cwd, '/opt/zhudatuan-staging/current');
  assert.equal(application.script, '/usr/bin/env');
  assert.equal(application.interpreter, 'none');
  assert.deepEqual(application.args.slice(0, 2), ['-i', 'PATH=/usr/bin:/bin']);
  assert.ok(application.args.includes('NODE_ENV=production'));
  assert.equal(application.instances, 1);
  assert.equal(application.exec_mode, 'fork');
  assert.match(application.error_file, /^\/var\/log\/zhudatuan-staging\//);
  assert.match(application.out_file, /^\/var\/log\/zhudatuan-staging\//);
}

assert.ok(api.args.includes('--env-file=/opt/zhudatuan-staging/shared/identity-registration-api.env'));
assert.ok(jobs.args.includes('--env-file=/opt/zhudatuan-staging/shared/identity-notification-jobs.env'));

for (const variable of [
  'ZHUDATUAN_STAGING_ACCOUNTS_HOST',
  'ZHUDATUAN_STAGING_CONSOLE_HOST',
  'ZHUDATUAN_STAGING_API_HOST',
]) {
  assert.ok(caddy.includes(`{$${variable}}`), `Caddy host placeholder missing: ${variable}`);
  assert.ok(delivery.includes(`hostEnv: ${variable}`), `delivery host environment missing: ${variable}`);
}

for (const token of [
  'root * /opt/zhudatuan-staging/current/apps/auth-web/dist',
  'root * /opt/zhudatuan-staging/current/apps/console/dist',
  'reverse_proxy 127.0.0.1:4421',
  'respond "Not Found" 404',
]) assert.ok(caddy.includes(token), `staging route missing: ${token}`);

for (const token of [
  'scope: identity-registration-and-sms-only',
  'artifact: services/commerce/dist/IdentityRegistrationApiMain.js',
  'artifact: services/commerce/dist/IdentityNotificationJobsOnlyMain.js',
  'fullJobsMain: forbidden',
  'redis: unused',
  'productionTrafficPercent: 0',
  'productionDataAccess: forbidden',
]) assert.ok(delivery.includes(token), `staging delivery contract missing: ${token}`);

for (const token of [
  '/opt/zhudatuan/current',
  '/opt/zhudatuan/shared',
  '/var/log/pm2',
  'accounts.zhudatuan.com',
  'console.zhudatuan.com',
  'api.zhudatuan.com',
]) assert.ok(!deploymentSources.includes(token), `production token forbidden in staging configuration: ${token}`);

assert.deepEqual(Object.keys(apiEnvironment).sort(), [
  'API_ALLOWED_ORIGINS',
  'AUTH_RETURN_TARGETS',
  'DATABASE_API_CONNECTION_REF',
  'IDENTITY_KEY_REF',
  'KMS_BEARER_TOKEN',
  'KMS_ENDPOINT',
  'NODE_EXTRA_CA_CERTS',
  'SECRET_STORE_BEARER_TOKEN',
  'SECRET_STORE_ENDPOINT',
  'SERVICE_VERSION',
  'SESSION_KEY_REF',
]);
assert.deepEqual(Object.keys(jobsEnvironment).sort(), [
  'DATABASE_JOB_CONNECTION_REF',
  'IDENTITY_NOTIFICATION_CONFIG_REF',
  'JOB_WORKER_ID',
  'KMS_BEARER_TOKEN',
  'KMS_ENDPOINT',
  'NODE_EXTRA_CA_CERTS',
  'SECRET_STORE_BEARER_TOKEN',
  'SECRET_STORE_ENDPOINT',
  'SERVICE_VERSION',
]);

for (const value of [
  apiEnvironment.SECRET_STORE_BEARER_TOKEN,
  apiEnvironment.KMS_BEARER_TOKEN,
  jobsEnvironment.SECRET_STORE_BEARER_TOKEN,
  jobsEnvironment.KMS_BEARER_TOKEN,
]) assert.match(value, /^[A-Za-z0-9_-]{43,512}$/);
assert.equal(new Set([
  apiEnvironment.SECRET_STORE_BEARER_TOKEN,
  apiEnvironment.KMS_BEARER_TOKEN,
  jobsEnvironment.SECRET_STORE_BEARER_TOKEN,
  jobsEnvironment.KMS_BEARER_TOKEN,
]).size, 4, 'all staging workload bearer placeholders must differ');

const forbiddenJobKeys = [
  'REDIS_CONNECTION_REF',
  'EXTENSION_MANIFEST_KEY_REF',
  'WECHAT_APPLICATION_CONFIG_REF',
  'WECHAT_PAYMENT_CONFIG_REF',
  'INVOICE_CONFIG_REF',
  'PAYOUT_CONFIG_REF',
  'NOTIFICATION_CONFIG_REF',
  'OBJECT_STORE_ENDPOINT',
  'OBJECT_STORE_TOKEN_REF',
];
for (const key of forbiddenJobKeys) assert.equal(jobsEnvironment[key], undefined, `minimal jobs environment includes ${key}`);

console.log('Isolated identity registration and SMS staging delivery verified.');

function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/u).flatMap((line) => {
    const candidate = line.trim();
    if (!candidate || candidate.startsWith('#')) return [];
    const separator = candidate.indexOf('=');
    assert.ok(separator > 0, `invalid environment line: ${candidate}`);
    const key = candidate.slice(0, separator);
    let value = candidate.slice(separator + 1);
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) value = value.slice(1, -1);
    return [[key, value]];
  }));
}
