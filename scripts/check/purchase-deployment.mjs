import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, join, normalize, resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFile(resolve(root, path), 'utf8');

const publicPaths = [
  '/api/v1/checkouts/quotes',
  '/api/v1/orders',
  '/api/v1/payments/intents',
];
const purchaseOperations = [
  'checkout.quote.create',
  'order.orders.create',
  'payment.intents.create',
];
const forbiddenOperations = [
  'payment.refunds.request',
  'payment.webhooks.wechat',
  'payment.recoveries.read',
  'payment.recoveries.resolve',
];

const [caddy, deliverySource, service, environment, configSource, buildSource, operationsSource,
  webBusinessOperationIds, purchaseMain, purchaseReady, migrationSource, runtimeSource, migrationRunnerSource,
  receiptSchemaSource, legacyStorefrontDeploy] = await Promise.all([
  read('infrastructure/zhudatuan/aliyun/Caddyfile'),
  read('infrastructure/zhudatuan/aliyun/delivery.yml'),
  read('infrastructure/zhudatuan/aliyun/systemd/zhudatuan-purchase-api.service'),
  read('infrastructure/zhudatuan/aliyun/purchase-api.env.example'),
  read('packages/config/src/PurchaseApiEnvironment.ts'),
  read('scripts/build-commerce.mjs'),
  read('packages/contract/definitions/operations.yml'),
  read('services/commerce/src/modules/webbusiness/WebBusinessOperationIds.ts'),
  read('services/commerce/src/entry/PurchaseApiMain.ts'),
  read('services/commerce/src/entry/PurchaseApiReadyMain.ts'),
  read('database/supabase/migrations/20260828180000_zhudatuan_purchase_access.sql'),
  read('services/commerce/src/bootstrap/PurchaseApiRuntime.ts'),
  read('services/commerce/src/foundation/infrastructure/RegistrationMigrationRunner.ts'),
  read('infrastructure/zhudatuan/aliyun/purchase-e2e-receipt.schema.json'),
  read('infrastructure/storefront-compatibility/aliyun/deploy.sh'),
]);

const apiHost = slice(caddy, 'api.zhudatuan.com {', 'media.zhudatuan.com {');
const blockedMatcher = apiHost.match(/^\s*@purchasePublicBlocked\s*\{([\s\S]*?)^\s*\}/m)?.[1];
if (!blockedMatcher) throw new Error('PURCHASE_PUBLIC_BLOCK_CADDY_MATCHER_MISSING');
const blockedMethods = blockedMatcher.match(/^\s*method\s+(.+)$/m)?.[1]?.trim().split(/\s+/) ?? [];
const blockedPaths = blockedMatcher.match(/^\s*path\s+(.+)$/m)?.[1]?.trim().split(/\s+/) ?? [];
assertExactSet(blockedMethods, ['POST', 'OPTIONS'], 'PURCHASE_PUBLIC_BLOCK_CADDY_METHODS');
assertExactSet(blockedPaths, publicPaths, 'PURCHASE_PUBLIC_BLOCK_CADDY_PATHS');
if (blockedPaths.some((path) => path.includes('*') || path.includes('{'))) {
  throw new Error('PURCHASE_PUBLIC_BLOCK_CADDY_NON_EXACT_PATH_FORBIDDEN');
}
const blockedHandle = apiHost.match(/handle\s+@purchasePublicBlocked\s*\{([\s\S]*?)^\s*\}/m)?.[1] ?? '';
if (!blockedHandle.includes('respond "Purchase cutover blocked" 503') || blockedHandle.includes('reverse_proxy')) {
  throw new Error('PURCHASE_PUBLIC_BLOCK_CADDY_HANDLER_INVALID');
}
const preflightMatcher = apiHost.match(/^\s*@purchasePreflight\s*\{([\s\S]*?)^\s*\}/m)?.[1];
if (!preflightMatcher) throw new Error('PURCHASE_PREFLIGHT_CADDY_MATCHER_MISSING');
const preflightMethods = preflightMatcher.match(/^\s*method\s+(.+)$/m)?.[1]?.trim().split(/\s+/) ?? [];
const preflightPaths = preflightMatcher.match(/^\s*path\s+(.+)$/m)?.[1]?.trim().split(/\s+/) ?? [];
assertExactSet(preflightMethods, ['OPTIONS'], 'PURCHASE_PREFLIGHT_CADDY_METHODS');
assertExactSet(preflightPaths, publicPaths, 'PURCHASE_PREFLIGHT_CADDY_PATHS');
if (preflightPaths.some((path) => path.includes('*') || path.includes('{'))) {
  throw new Error('PURCHASE_PREFLIGHT_CADDY_NON_EXACT_PATH_FORBIDDEN');
}
const preflightHandle = apiHost.match(/handle\s+@purchasePreflight\s*\{([\s\S]*?)^\s*\}/m)?.[1] ?? '';
if (!preflightHandle.includes('reverse_proxy 127.0.0.1:4323') || preflightHandle.match(/reverse_proxy/g)?.length !== 1) {
  throw new Error('PURCHASE_PREFLIGHT_CADDY_PROXY_INVALID');
}
const matcher = apiHost.match(/^\s*@purchaseApi\s*\{([\s\S]*?)^\s*\}/m)?.[1];
if (!matcher) throw new Error('PURCHASE_CADDY_MATCHER_MISSING');
const methods = matcher.match(/^\s*method\s+(.+)$/m)?.[1]?.trim().split(/\s+/) ?? [];
const paths = matcher.match(/^\s*path\s+(.+)$/m)?.[1]?.trim().split(/\s+/) ?? [];
assertExactSet(methods, ['POST'], 'PURCHASE_CADDY_METHODS');
assertExactSet(paths, publicPaths, 'PURCHASE_CADDY_PATHS');
if (paths.some((path) => path.includes('*') || path.includes('{'))) throw new Error('PURCHASE_CADDY_NON_EXACT_PATH_FORBIDDEN');
const purchaseHandle = apiHost.match(/handle\s+@purchaseApi\s*\{([\s\S]*?)^\s*\}/m)?.[1] ?? '';
if (!purchaseHandle.includes('reverse_proxy 127.0.0.1:4323') || purchaseHandle.match(/reverse_proxy/g)?.length !== 1) {
  throw new Error('PURCHASE_CADDY_PROXY_INVALID');
}
if (apiHost.indexOf('handle @purchasePublicBlocked') > apiHost.indexOf('handle @purchasePreflight')
  || apiHost.indexOf('handle @purchasePublicBlocked') > apiHost.indexOf('handle @purchaseApi')
  || apiHost.indexOf('handle @purchasePreflight') > apiHost.indexOf('handle @purchaseApi')
  || apiHost.indexOf('handle @purchaseApi') > apiHost.indexOf('handle @webBusinessApi')
  || apiHost.indexOf('handle @purchaseApi') > apiHost.indexOf('respond "Not Found" 404')) {
  throw new Error('PURCHASE_CADDY_HANDLER_ORDER_INVALID');
}

const delivery = parse(deliverySource);
if (delivery?.runtime?.purchaseApiPort !== 4323 || delivery?.runtime?.purchaseApiProfile !== 'purchase-only') {
  throw new Error('PURCHASE_DELIVERY_RUNTIME_INVALID');
}
const route = delivery?.routes?.purchaseApi;
if (route?.artifact !== 'services/commerce/dist/PurchaseApiMain.js'
  || route?.readinessArtifact !== 'services/commerce/dist/PurchaseApiReadyMain.js'
  || route?.process !== 'zhudatuan-purchase-api'
  || route?.service !== 'infrastructure/zhudatuan/aliyun/systemd/zhudatuan-purchase-api.service'
  || route?.environment !== 'infrastructure/zhudatuan/aliyun/purchase-api.env.example'
  || route?.port !== 4323 || route?.profile !== 'purchase-only') {
  throw new Error('PURCHASE_DELIVERY_ROUTE_INVALID');
}
assertExactSet(route?.allowedMethods ?? [], ['POST'], 'PURCHASE_DELIVERY_METHODS');
assertExactSet(route?.allowedPaths ?? [], publicPaths, 'PURCHASE_DELIVERY_PATHS');
assertExactSet(route?.preflightMethods ?? [], ['OPTIONS'], 'PURCHASE_DELIVERY_PREFLIGHT_METHODS');
assertExactSet(route?.preflightPaths ?? [], publicPaths, 'PURCHASE_DELIVERY_PREFLIGHT_PATHS');
assertExactSet(route?.forbiddenOperations ?? [], forbiddenOperations, 'PURCHASE_DELIVERY_FORBIDDEN_OPERATIONS');
if (delivery?.release?.publicCutoverRequiresPurchaseE2e !== true
  || delivery?.release?.publicCutover !== 'blocked'
  || delivery?.release?.publicCutoverBlockReason !== 'purchase-e2e-receipt-not-produced'
  || delivery?.release?.purchaseE2eReceiptSchema !== 'infrastructure/zhudatuan/aliyun/purchase-e2e-receipt.schema.json'
  || delivery?.release?.purchaseE2eReceipt !== null) {
  throw new Error('PURCHASE_PUBLIC_CUTOVER_MUST_REMAIN_BLOCKED');
}
if (!delivery?.forbiddenInputs?.includes('infrastructure/storefront-compatibility/aliyun')
  || !legacyStorefrontDeploy.includes('systemctl reload caddy')) {
  throw new Error('LEGACY_CADDY_RELOAD_MUST_REMAIN_EXCLUDED');
}
for (const file of executableFiles([
  resolve(root, 'infrastructure/zhudatuan/aliyun'),
  resolve(root, 'scripts/release'),
])) {
  const source = readFileSync(file, 'utf8');
  if (/(?:caddy\s+(?:reload|start|run)|systemctl\s+reload\s+caddy)/i.test(source)) {
    throw new Error(`PURCHASE_BLOCKED_CADDY_ACTIVATION_SCRIPT:${file}`);
  }
}

const receiptSchema = JSON.parse(receiptSchemaSource);
assertExactSet(receiptSchema.required ?? [], [
  'schema', 'releaseCommit', 'schemaVersion', 'schemaChecksum', 'targetEnvironment', 'databaseRole', 'databaseName',
  'serverFingerprint', 'completedAt', 'checks',
], 'PURCHASE_RECEIPT_REQUIRED_FIELDS');
assertExactSet(receiptSchema.properties?.checks?.required ?? [], [
  'quoteCreated', 'orderCreated', 'paymentIntentCreated', 'paymentCaptured', 'benefitDebited', 'benefitLedgerRecorded',
  'benefitLotMovementRecorded', 'inventoryStockUpdated', 'inventoryReservationRecorded', 'orderReadable', 'fulfillmentCreated',
  'outboxRecorded', 'jobRecorded', 'idempotentReplayVerified', 'rollbackVerified', 'negativeRoutesRejected', 'auditRecorded',
], 'PURCHASE_RECEIPT_CHECKS');
if (receiptSchema.additionalProperties !== false
  || receiptSchema.properties?.schema?.const !== 'zhudatuan.purchase-e2e-receipt.v1'
  || receiptSchema.properties?.schemaVersion?.const !== '20260828180000'
  || receiptSchema.properties?.targetEnvironment?.const !== 'production'
  || receiptSchema.properties?.databaseRole?.const !== 'zhudatuanpurchaseapi'
  || receiptSchema.properties?.databaseName?.const !== 'zhudatuan_registration'
  || receiptSchema.properties?.serverFingerprint?.not?.const !== `sha256:${'0'.repeat(64)}`
  || receiptSchema.properties?.schemaChecksum?.not?.const !== '0'.repeat(64)
  || receiptSchema.$defs?.passedCheck?.properties?.passed?.const !== true
  || receiptSchema.$defs?.passedCheck?.properties?.evidenceSha256?.not?.const !== '0'.repeat(64)
  || receiptSchema.$defs?.passedCheck?.additionalProperties !== false) {
  throw new Error('PURCHASE_RECEIPT_CONTRACT_INVALID');
}

for (const token of [
  'ConditionPathExists=/opt/zhudatuan/current/services/commerce/dist/PurchaseApiMain.js',
  'ConditionPathExists=/opt/zhudatuan/current/services/commerce/dist/PurchaseApiReadyMain.js',
  'ConditionPathExists=/opt/zhudatuan/shared/purchase-api.env',
  'Environment=PURCHASE_API_PROFILE=purchase-only',
  'Environment=API_PORT=4323',
  'Environment=API_BIND_HOST=127.0.0.1',
  'EnvironmentFile=/opt/zhudatuan/shared/purchase-api.env',
  'ExecStart=/usr/bin/env PURCHASE_API_PROFILE=purchase-only API_PORT=4323 API_BIND_HOST=127.0.0.1 /usr/bin/node services/commerce/dist/PurchaseApiMain.js',
  'ExecStartPost=/usr/bin/env PURCHASE_API_PROFILE=purchase-only API_PORT=4323 API_BIND_HOST=127.0.0.1 /usr/bin/node services/commerce/dist/PurchaseApiReadyMain.js',
  'NoNewPrivileges=true',
  'ProtectSystem=strict',
  'CapabilityBoundingSet=',
  'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6',
]) {
  if (!service.includes(token)) throw new Error(`PURCHASE_SYSTEMD_TOKEN_MISSING:${token}`);
}
if (service.includes('0.0.0.0') || service.includes('EnvironmentFile=-')) throw new Error('PURCHASE_SYSTEMD_FAIL_OPEN');

const environmentKeys = environment.split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.slice(0, line.indexOf('=')));
assertExactSet(environmentKeys, [
  'APP_ENV',
  'AUTH_MODE',
  'SERVICE_VERSION',
  'API_ALLOWED_ORIGINS',
  'DATABASE_API_CONNECTION_REF',
  'QUOTE_KEY_REF',
  'SECRET_STORE_ENDPOINT',
  'SECRET_STORE_BEARER_TOKEN',
  'NODE_EXTRA_CA_CERTS',
], 'PURCHASE_ENVIRONMENT_KEYS');
if (!environment.includes('API_ALLOWED_ORIGINS=https://zhudatuan.com')
  || !environment.includes('DATABASE_API_CONNECTION_REF=zhudatuan/purchase/database/api')
  || !environment.includes('QUOTE_KEY_REF=zhudatuan/purchase/checkout/quote')
  || !environment.includes('NODE_EXTRA_CA_CERTS=/opt/zhudatuan/shared/tls/internal-ca.crt')) {
  throw new Error('PURCHASE_PRIVATE_DEPENDENCY_CONFIGURATION_INVALID');
}

const configKeysBlock = configSource.match(/PURCHASE_API_ENVIRONMENT_KEYS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\s*as const\)/)?.[1] ?? '';
const configKeys = [...configKeysBlock.matchAll(/'([A-Z][A-Z0-9_]*)'/g)].map((match) => match[1]);
assertExactSet(configKeys, [
  'PURCHASE_API_PROFILE', 'API_PORT', 'API_BIND_HOST', 'APP_ENV', 'AUTH_MODE', 'SERVICE_VERSION', 'API_ALLOWED_ORIGINS',
  'DATABASE_API_CONNECTION_REF', 'QUOTE_KEY_REF', 'SECRET_STORE_ENDPOINT', 'SECRET_STORE_BEARER_TOKEN',
], 'PURCHASE_CONFIG_KEYS');

for (const token of [
  "PurchaseApiMain: 'services/commerce/src/entry/PurchaseApiMain.ts'",
  "PurchaseApiReadyMain: 'services/commerce/src/entry/PurchaseApiReadyMain.ts'",
]) {
  if (!buildSource.includes(token)) throw new Error(`PURCHASE_BUILD_ENTRY_MISSING:${token}`);
}
const migrationMarker = migrationSource.match(/values\('20260828180000','([a-f0-9]{64})'\)/)?.[1];
const runtimeMarker = runtimeSource.match(/PURCHASE_SCHEMA_CHECKSUM = '([a-f0-9]{64})'/)?.[1];
const runnerMarker = migrationRunnerSource.match(/REGISTRATION_TARGET_CHECKSUM = '([a-f0-9]{64})'/)?.[1];
if (!migrationMarker || migrationMarker === '0'.repeat(64) || migrationMarker !== runtimeMarker || migrationMarker !== runnerMarker) {
  throw new Error('PURCHASE_SCHEMA_MARKER_DRIFT');
}
const normalizedMigrationDigest = createHash('sha256')
  .update(migrationSource.replaceAll(migrationMarker, '0'.repeat(64)))
  .digest('hex');
if (normalizedMigrationDigest !== migrationMarker) {
  throw new Error('PURCHASE_SCHEMA_NORMALIZED_DIGEST_DRIFT');
}
if (receiptSchema.properties?.schemaChecksum?.const !== migrationMarker) {
  throw new Error('PURCHASE_RECEIPT_SCHEMA_MARKER_DRIFT');
}
if (!migrationRunnerSource.includes("REGISTRATION_TARGET_VERSION = '20260828180000'")
  || !migrationRunnerSource.includes("name='20260828180000_zhudatuan_purchase_access.sql'")) {
  throw new Error('PURCHASE_REGISTRATION_MIGRATION_TARGET_INVALID');
}
for (const token of ['purchaseApiEnvironment', 'purchaseApiPort', '/health/ready', 'ZHUDATUAN_PURCHASE_API_READY']) {
  if (!purchaseReady.includes(token)) throw new Error(`PURCHASE_READINESS_BOUNDARY_MISSING:${token}`);
}
if (!purchaseMain.includes('purchaseApiEnvironment') || !purchaseMain.includes('purchaseApiPort')) {
  throw new Error('PURCHASE_ENTRY_CONFIGURATION_BOUNDARY_MISSING');
}

const operations = parse(operationsSource)?.operations ?? [];
const knownOperationIds = new Set(operations.map(({ id }) => id));
const exposed = operations.filter(({ method, path }) => method === 'POST' && publicPaths.includes(path)).map(({ id }) => id);
assertExactSet(exposed, purchaseOperations, 'PURCHASE_CONTRACT_OPERATIONS');
for (const operation of purchaseOperations) {
  if (webBusinessOperationIds.includes(`'${operation}'`) || webBusinessOperationIds.includes(`"${operation}"`)) {
    throw new Error(`WEB_BUSINESS_PURCHASE_OPERATION_FORBIDDEN:${operation}`);
  }
}

const closure = sourceClosure(resolve(root, 'services/commerce/src/entry/PurchaseApiMain.ts'));
const forbiddenSourcePaths = [
  '/bootstrap/CommerceRuntime.ts',
  '/bootstrap/ProviderLoader.ts',
  '/bootstrap/ProviderFactories.ts',
  '/app/modules.ts',
  '/foundation/infrastructure/ObjectStore.ts',
  '/foundation/cache/',
  '/modules/finance/',
  '/modules/benefit/BenefitPort.ts',
  '/modules/voucher/application/port/VoucherPort.ts',
  '/modules/channel/',
  '/modules/payment/PaymentModule.ts',
  '/modules/payment/PaymentOperations.ts',
  '/modules/payment/PaymentJobs.ts',
  '/modules/payment/PaymentWebhook.ts',
  '/modules/payment/PaymentOperationSupport.ts',
  '/modules/payment/application/RefundPlanner.ts',
  '/modules/payment/application/RefundSettlement.ts',
  '/modules/payment/interface/',
  '/modules/payment/infrastructure/',
  '/modules/order/OrderOperations.ts',
  '/modules/reporting/',
  '/modules/extension/',
];
const forbiddenClosure = [...closure].filter((file) => forbiddenSourcePaths.some((path) => file.includes(path)));
if (forbiddenClosure.length > 0) throw new Error(`PURCHASE_FORBIDDEN_SOURCE_CLOSURE:${JSON.stringify(forbiddenClosure)}`);
for (const file of closure) {
  const source = readFileSync(file, 'utf8');
  if (source.includes('commerce-api') || source.includes('hbbtzn') || /@shop\/(?:provider|wechatpayment)/.test(source)
    || /(?:^|\/)apps\//.test(file)) throw new Error(`PURCHASE_FORBIDDEN_SOURCE_TOKEN:${file}`);
}
const ownedSources = [...closure].filter((file) => basename(file).includes('Purchase')
  || file.includes('/modules/purchase/')
  || (file.includes('/modules/') && basename(file).endsWith('Operations.ts') && basename(file) !== 'ModuleOperations.ts'));
const ownedOperationIds = new Set();
for (const file of ownedSources) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/['"]([a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+)['"]/g)) {
    if (knownOperationIds.has(match[1]) && !match[1].startsWith('runtime.health.')) ownedOperationIds.add(match[1]);
  }
}
assertExactSet([...ownedOperationIds], purchaseOperations, 'PURCHASE_ENTRY_OPERATIONS');
for (const operation of forbiddenOperations) {
  if (ownedOperationIds.has(operation)) throw new Error(`PURCHASE_FORBIDDEN_OPERATION:${operation}`);
}

console.log(`purchase deployment: ${publicPaths.length} exact POST + OPTIONS public 503 gates, ${closure.size} safe sources, loopback 4323, hardened systemd`);

function slice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error('CADDY_HOST_BOUNDARY_MISSING');
  return source.slice(start, end);
}

function assertExactSet(actual, expected, label) {
  if (actual.length !== new Set(actual).size) throw new Error(`${label}:DUPLICATED`);
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) {
    throw new Error(`${label}:INVALID:${JSON.stringify(sortedActual)}`);
  }
}

function sourceClosure(entry) {
  const visited = new Set();
  const visit = (file) => {
    const normalized = normalize(file);
    if (visited.has(normalized)) return;
    visited.add(normalized);
    const source = readFileSync(normalized, 'utf8');
    for (const match of source.matchAll(/(?:from\s+|import\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g)) {
      const base = join(dirname(normalized), match[2]);
      const candidate = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find(existsSync);
      if (candidate) visit(candidate);
    }
  };
  visit(entry);
  return visited;
}

function executableFiles(directories) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.(?:sh|mjs|js|ts)$/.test(entry.name)) files.push(path);
    }
  };
  for (const directory of directories) visit(directory);
  return files;
}
