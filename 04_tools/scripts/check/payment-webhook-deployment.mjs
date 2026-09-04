import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const root = repositoryRoot;
const read = (path) => readFile(resolve(root, path), 'utf8');
const [main, runtime, entryTest, config, configTest, service, environment, caddy, delivery,
  migration, roleProvisioner, build, purchaseMain, purchaseTest] = await Promise.all([
  read('01_core_hexin/services/commerce/src/entry/PaymentWebhookApiMain.ts'),
  read('01_core_hexin/services/commerce/src/bootstrap/PaymentWebhookApiRuntime.ts'),
  read('01_core_hexin/services/commerce/src/entry/PaymentWebhookApiEntrypoint.test.ts'),
  read('01_core_hexin/packages/config/src/PaymentWebhookApiEnvironment.ts'),
  read('01_core_hexin/packages/config/src/PaymentWebhookApiEnvironment.test.ts'),
  read('02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-payment-webhook-api.service'),
  read('02_platform_pingtai/infrastructure/zhudatuan/aliyun/payment-webhook-api.env.example'),
  read('02_platform_pingtai/infrastructure/zhudatuan/aliyun/Caddyfile'),
  read('02_platform_pingtai/infrastructure/zhudatuan/aliyun/delivery.yml'),
  read('02_platform_pingtai/database/supabase/migrations/20260903110000_zhudatuan_payment_webhook_access.sql'),
  read('02_platform_pingtai/infrastructure/zhudatuan/aliyun/postgres-provision-payment-webhook-role.sh'),
  read('04_tools/scripts/build-commerce.mjs'),
  read('01_core_hexin/services/commerce/src/entry/PurchaseApiMain.ts'),
  read('01_core_hexin/services/commerce/src/entry/PurchaseApiEntrypoint.test.ts'),
]);

for (const token of [
  'PaymentWebhookApiModule',
  'PAYMENT_WEBHOOK_OPERATION_IDS',
  "listen(bootstrapped.app, paymentWebhookApiPort(environment), '127.0.0.1')",
  'allowedOrigins: []',
]) if (!main.includes(token)) throw new Error(`PAYMENT_WEBHOOK_ENTRY_TOKEN_MISSING:${token}`);
for (const forbidden of ['COMMERCE_MODULES', 'PurchaseRuntimeModule', 'PURCHASE_MODULES', 'PaymentModule']) {
  if (main.includes(forbidden)) throw new Error(`PAYMENT_WEBHOOK_ENTRY_COUPLING_FORBIDDEN:${forbidden}`);
}

for (const token of [
  "'payment.webhooks.wechat'",
  "current_user !== 'zhudatuanpaymentwebhookapi'",
  "session_user !== 'zhudatuanpaymentwebhookapi'",
  "not has_schema_privilege(current_user,'identity','USAGE')",
  "not has_table_privilege(current_user,'runtime.rawenvelope','SELECT,INSERT,UPDATE,DELETE')",
  'new PaymentWebhook(',
  'new WechatGateway(',
  'await assertPaymentWebhookRuntimeCompatibility(pool)',
  "new Error('PROVIDER_SIGNATURE_MISSING')",
  "new Error('PROVIDER_WEBHOOK_SIGNATURE_INVALID')",
]) if (!runtime.includes(token)) throw new Error(`PAYMENT_WEBHOOK_RUNTIME_TOKEN_MISSING:${token}`);
for (const forbidden of ['PurchaseApiRuntime', 'CommerceRuntime', 'KMS_CLIENT', 'PaymentOperations']) {
  if (runtime.includes(forbidden)) throw new Error(`PAYMENT_WEBHOOK_RUNTIME_COUPLING_FORBIDDEN:${forbidden}`);
}

for (const token of [
  "expect(PAYMENT_WEBHOOK_OPERATION_IDS).toEqual(['payment.webhooks.wechat'])",
  "code: 'PROVIDER_SIGNATURE_MISSING'",
  "code: 'PROVIDER_WEBHOOK_SIGNATURE_INVALID'",
  'expect(database.connections()).toBe(0)',
  'expect(database.jobs()).toBe(1)',
  'expect(database.audits()).toBe(1)',
]) if (!entryTest.includes(token)) throw new Error(`PAYMENT_WEBHOOK_TEST_TOKEN_MISSING:${token}`);

const configKeysBlock = config.match(/PAYMENT_WEBHOOK_API_ENVIRONMENT_KEYS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\s*as const\)/)?.[1] ?? '';
const configKeys = [...configKeysBlock.matchAll(/'([A-Z][A-Z0-9_]*)'/g)].map((match) => match[1]);
assertExactSet(configKeys, [
  'PAYMENT_WEBHOOK_API_PROFILE', 'API_PORT', 'API_BIND_HOST', 'APP_ENV', 'SERVICE_VERSION',
  'DATABASE_API_CONNECTION_REF', 'SECRET_STORE_ENDPOINT', 'SECRET_STORE_BEARER_TOKEN',
  'WECHAT_APPLICATION_CONFIG_REF', 'WECHAT_PAYMENT_CONFIG_REF',
], 'PAYMENT_WEBHOOK_CONFIG_KEYS');
for (const token of ["PAYMENT_WEBHOOK_API_PROFILE = 'payment-webhook-only'", '!== 4326',
  "source.SECRET_STORE_ENDPOINT !== 'https://127.0.0.1:8543'", 'QUOTE_KEY_REF']) {
  if (token === 'QUOTE_KEY_REF' ? !configTest.includes(token) : !config.includes(token)) {
    throw new Error(`PAYMENT_WEBHOOK_CONFIG_BOUNDARY_MISSING:${token}`);
  }
}

for (const token of [
  'ConditionPathExists=/opt/zhudatuan/current/01_core_hexin/services/commerce/dist/PaymentWebhookApiMain.js',
  'ConditionPathExists=/opt/zhudatuan/current/01_core_hexin/services/commerce/dist/PaymentWebhookApiReadyMain.js',
  'Environment=PAYMENT_WEBHOOK_API_PROFILE=payment-webhook-only',
  'Environment=API_PORT=4326',
  'Environment=API_BIND_HOST=127.0.0.1',
  'EnvironmentFile=/opt/zhudatuan/shared/payment-webhook-api.env',
  'ExecStart=/usr/bin/env PAYMENT_WEBHOOK_API_PROFILE=payment-webhook-only API_PORT=4326 API_BIND_HOST=127.0.0.1 /usr/bin/node 01_core_hexin/services/commerce/dist/PaymentWebhookApiMain.js',
  'ExecStartPost=/usr/bin/env PAYMENT_WEBHOOK_API_PROFILE=payment-webhook-only API_PORT=4326 API_BIND_HOST=127.0.0.1 /usr/bin/node 01_core_hexin/services/commerce/dist/PaymentWebhookApiReadyMain.js',
]) if (!service.includes(token)) throw new Error(`PAYMENT_WEBHOOK_SYSTEMD_TOKEN_MISSING:${token}`);
if (service.includes('0.0.0.0') || service.includes('EnvironmentFile=-')) throw new Error('PAYMENT_WEBHOOK_SYSTEMD_FAIL_OPEN');

const environmentKeys = environment.split(/\r?\n/).filter((line) => line && !line.startsWith('#'))
  .map((line) => line.slice(0, line.indexOf('=')));
assertExactSet(environmentKeys, [
  'APP_ENV', 'SERVICE_VERSION', 'DATABASE_API_CONNECTION_REF', 'SECRET_STORE_ENDPOINT',
  'SECRET_STORE_BEARER_TOKEN', 'WECHAT_APPLICATION_CONFIG_REF', 'WECHAT_PAYMENT_CONFIG_REF', 'NODE_EXTRA_CA_CERTS',
], 'PAYMENT_WEBHOOK_ENVIRONMENT_KEYS');

if ((caddy.match(/path \/api\/v1\/webhooks\/wechat\/payment/g) ?? []).length !== 1
  || (caddy.match(/reverse_proxy 127\.0\.0\.1:4326/g) ?? []).length !== 1
  || !caddy.includes('@paymentWebhookApi') || !caddy.includes('method POST')) {
  throw new Error('PAYMENT_WEBHOOK_CADDY_ROUTE_INVALID');
}
for (const token of [
  'paymentWebhookApiPort: 4326', 'paymentWebhookApiProfile: payment-webhook-only',
  'databaseRole: zhudatuanpaymentwebhookapi', 'postgres-provision-payment-webhook-role.sh',
]) if (!delivery.includes(token)) throw new Error(`PAYMENT_WEBHOOK_DELIVERY_TOKEN_MISSING:${token}`);
for (const token of [
  "PaymentWebhookApiMain: '01_core_hexin/services/commerce/src/entry/PaymentWebhookApiMain.ts'",
  "PaymentWebhookApiReadyMain: '01_core_hexin/services/commerce/src/entry/PaymentWebhookApiReadyMain.ts'",
]) if (!build.includes(token)) throw new Error(`PAYMENT_WEBHOOK_BUILD_ENTRY_MISSING:${token}`);

const marker = migration.match(/values\('20260903110000','([a-f0-9]{64})'\)/)?.[1];
const runtimeMarker = runtime.match(/PAYMENT_WEBHOOK_SCHEMA_CHECKSUM = '([a-f0-9]{64})'/)?.[1];
if (!marker || marker !== runtimeMarker || marker === '0'.repeat(64)) throw new Error('PAYMENT_WEBHOOK_SCHEMA_MARKER_DRIFT');
const normalized = createHash('sha256').update(migration.replaceAll(marker, '0'.repeat(64))).digest('hex');
if (normalized !== marker) throw new Error('PAYMENT_WEBHOOK_SCHEMA_NORMALIZED_DIGEST_DRIFT');
for (const token of [
  'zhudatuanpaymentwebhookapi', 'payment.webhook_scope(text,text,text)',
  'runtime.accept_provider_webhook(text,text,text,jsonb,text,text,text,integer,jsonb)',
  'runtime.job', 'audit.record', 'payment.refundtender',
]) if (!migration.includes(token)) throw new Error(`PAYMENT_WEBHOOK_MIGRATION_BOUNDARY_MISSING:${token}`);
for (const token of [
  'ZHUDATUAN_EXPECTED_RDS_SERVER_ADDR', 'ZHUDATUAN_PAYMENT_WEBHOOK_API_PASSWORD',
  "current_database()<>'zhudatuan_registration'", 'deployment.boundary',
  'create role zhudatuanpaymentwebhookapi login password',
]) if (!roleProvisioner.includes(token)) throw new Error(`PAYMENT_WEBHOOK_ROLE_PROVISIONER_MISSING:${token}`);
if (roleProvisioner.includes('alter role zhudatuanpaymentwebhookapi login password')) {
  throw new Error('PAYMENT_WEBHOOK_ROLE_PROVISIONER_PASSWORD_ROTATION_FORBIDDEN');
}
if (!purchaseMain.includes('PURCHASE_OPERATION_IDS') || purchaseMain.includes('PAYMENT_WEBHOOK_OPERATION_IDS')
  || !purchaseTest.includes("'/modules/payment_zhifu/05_interface_jieru/http/PaymentWebhook.ts'")) {
  throw new Error('PURCHASE_API_OPERATION_BOUNDARY_DRIFT');
}

console.log('payment webhook deployment contract passed: operations=1 profile=selected role=dedicated port=4326 route=exact');

function assertExactSet(actual, expected, code) {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  if (left.length !== actual.length || JSON.stringify(left) !== JSON.stringify(right)) throw new Error(code);
}
