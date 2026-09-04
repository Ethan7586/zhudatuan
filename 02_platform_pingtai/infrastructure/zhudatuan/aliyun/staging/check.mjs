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
const environment = await readFile(resolve(directory, '.env.example'), 'utf8');
const sources = `${caddy}\n${delivery}\n${environment}`;

assert.deepEqual(processConfig.apps.map(({ name }) => name).sort(), [
  'zhudatuan-staging-api',
  'zhudatuan-staging-jobs',
]);

const byName = new Map(processConfig.apps.map((application) => [application.name, application]));
const api = byName.get('zhudatuan-staging-api');
const jobs = byName.get('zhudatuan-staging-jobs');
assert.equal(api.script, '01_core_hexin/services/commerce/dist/ApiMain.js');
assert.equal(api.env.API_PORT, '3101');
assert.equal(jobs.script, '01_core_hexin/services/commerce/dist/JobsMain.js');
assert.ok(jobs.kill_timeout >= 120_000, 'JobsMain must have time to stop active jobs');

for (const application of processConfig.apps) {
  assert.equal(application.cwd, '/opt/zhudatuan-staging/current');
  assert.deepEqual(application.node_args, ['--env-file=/opt/zhudatuan-staging/shared/.env.staging']);
  assert.equal(application.env.APP_ENV, 'production', 'public staging must keep production-safe runtime behaviour');
  assert.equal(application.instances, 1);
  assert.equal(application.exec_mode, 'fork');
  assert.match(application.error_file, /^\/var\/log\/zhudatuan-staging\//);
  assert.match(application.out_file, /^\/var\/log\/zhudatuan-staging\//);
}

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
  'reverse_proxy 127.0.0.1:3101',
]) assert.ok(caddy.includes(token), `staging route missing: ${token}`);

for (const token of [
  'artifact: 01_core_hexin/apps/auth-web/dist',
  'artifact: 01_core_hexin/apps/console/dist',
  'entrypoint: 01_core_hexin/services/commerce/dist/JobsMain.js',
  'environment: staging',
]) assert.ok(delivery.includes(token), `staging delivery contract missing: ${token}`);

for (const token of [
  '/opt/zhudatuan/current',
  '/opt/zhudatuan/shared',
  '/var/log/pm2',
  'accounts.zhudatuan.com',
  'console.zhudatuan.com',
  'api.zhudatuan.com',
]) assert.ok(!sources.includes(token), `production token forbidden in staging configuration: ${token}`);

for (const key of [
  'DATABASE_API_CONNECTION_REF',
  'DATABASE_JOB_CONNECTION_REF',
  'REDIS_CONNECTION_REF',
  'SECRET_STORE_ENDPOINT',
  'KMS_ENDPOINT',
  'NOTIFICATION_CONFIG_REF',
  'JOB_WORKER_ID',
]) assert.match(environment, new RegExp(`^${key}=.+$`, 'm'), `staging environment key missing: ${key}`);

assert.ok(delivery.includes('productionTrafficPercent: 0'));
assert.ok(delivery.includes('productionDataAccess: forbidden'));
assert.ok(!/(?:ACCESS_KEY_SECRET|PASSWORD|PRIVATE_KEY)=\S+/i.test(environment), 'secret value found in staging example');

console.log('Isolated staging delivery configuration verified.');
