import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFile(resolve(root, path), 'utf8');

const publicPaths = [
  '/api/v1/members/me',
  '/api/v1/members/me/addresses',
  '/api/v1/members/me/addresses/*',
  '/api/v1/organizations/layers',
  '/api/v1/reports/dashboard',
  '/api/v1/catalog/listings',
  '/api/v1/pricing/offers',
  '/api/v1/inventory/availability',
  '/api/v1/carts/current',
  '/api/v1/carts/current/*',
  '/api/v1/benefits/accounts',
  '/api/v1/benefits/ledgers',
  '/api/v1/orders',
];
const contractPaths = [
  '/api/v1/members/me',
  '/api/v1/members/me/addresses',
  '/api/v1/members/me/addresses/{addressid}',
  '/api/v1/organizations/layers',
  '/api/v1/reports/dashboard',
  '/api/v1/catalog/listings',
  '/api/v1/pricing/offers',
  '/api/v1/inventory/availability',
  '/api/v1/carts/current',
  '/api/v1/carts/current/items/{listingid}',
  '/api/v1/carts/current/items/batches',
  '/api/v1/benefits/accounts',
  '/api/v1/benefits/ledgers',
  '/api/v1/orders',
];

const [caddy, deliverySource, service, environment, buildSource, operationsSource, baselineMigrationSource,
  webBusinessMigrationSource, runtimeSource, sandboxPlanSource] = await Promise.all([
  read('infrastructure/zhudatuan/aliyun/Caddyfile'),
  read('infrastructure/zhudatuan/aliyun/delivery.yml'),
  read('infrastructure/zhudatuan/aliyun/systemd/zhudatuan-web-api.service'),
  read('infrastructure/zhudatuan/aliyun/web-business-api.env.example'),
  read('scripts/build-commerce.mjs'),
  read('packages/contract/definitions/operations.yml'),
  read('database/supabase/migrations/20260828173000_zhudatuan_web_business_access.sql'),
  read('database/supabase/migrations/20260828180000_zhudatuan_purchase_access.sql'),
  read('services/commerce/src/bootstrap/WebBusinessApiRuntime.ts'),
  read('tools/seed/src/SandboxCatalogBootstrapPlan.ts'),
]);
const operations = parse(operationsSource)?.operations ?? [];

const caddyMatch = caddy.match(/^\s*@webBusinessApi path (.+)$/m);
if (!caddyMatch) throw new Error('WEB_BUSINESS_CADDY_MATCHER_MISSING');
assertExactSet(caddyMatch[1].trim().split(/\s+/), publicPaths, 'WEB_BUSINESS_CADDY_PATHS');

const apiHost = slice(caddy, 'api.zhudatuan.com {', 'media.zhudatuan.com {');
assertCaddyMatcher(apiHost, 'registrationHealth', ['GET'], ['/health/live', '/health/ready', '/health/startup']);
assertCaddyMatcher(apiHost, 'registrationPreflight', ['OPTIONS'], [
  '/api/v1/identity/sessions',
  '/api/v1/identity/tickets/exchange',
  '/api/v1/identity/session',
  '/api/v1/identity/challenges',
  '/api/v1/identity/invitations/resolve',
  '/api/v1/identity/members',
]);
assertCaddyMatcher(apiHost, 'registrationPost', ['POST'], [
  '/api/v1/identity/sessions',
  '/api/v1/identity/tickets/exchange',
  '/api/v1/identity/challenges',
  '/api/v1/identity/invitations/resolve',
  '/api/v1/identity/members',
]);
assertCaddyMatcher(apiHost, 'registrationSessionRead', ['GET'], ['/api/v1/identity/session']);
assertCaddyMatcher(apiHost, 'registrationSessionDelete', ['DELETE'], ['/api/v1/identity/session']);
assertCaddyMatcher(apiHost, 'purchasePublicBlocked', ['POST', 'OPTIONS'], [
  '/api/v1/checkouts/quotes',
  '/api/v1/orders',
  '/api/v1/payments/intents',
]);
assertCaddyMatcher(apiHost, 'purchasePreflight', ['OPTIONS'], [
  '/api/v1/checkouts/quotes',
  '/api/v1/orders',
  '/api/v1/payments/intents',
]);
const registrationOperations = [
  ['runtime.health.live', 'GET', '/health/live'],
  ['runtime.health.ready', 'GET', '/health/ready'],
  ['runtime.health.startup', 'GET', '/health/startup'],
  ['identity.sessions.create', 'POST', '/api/v1/identity/sessions'],
  ['identity.tickets.exchange', 'POST', '/api/v1/identity/tickets/exchange'],
  ['identity.session.read', 'GET', '/api/v1/identity/session'],
  ['identity.session.delete', 'DELETE', '/api/v1/identity/session'],
  ['identity.challenges.create', 'POST', '/api/v1/identity/challenges'],
  ['identity.invitations.read', 'POST', '/api/v1/identity/invitations/resolve'],
  ['identity.members.create', 'POST', '/api/v1/identity/members'],
];
for (const [id, method, path] of registrationOperations) {
  const operation = operations.find((candidate) => candidate.id === id);
  if (operation?.method !== method || operation?.path !== path) throw new Error(`IDENTITY_REGISTRATION_CONTRACT_ROUTE_INVALID:${id}`);
}
if (apiHost.includes('/api/v1/*')) throw new Error('GENERIC_CANONICAL_API_WILDCARD_FORBIDDEN');
assertExactSet(
  [...apiHost.matchAll(/^\s*@(\w+)(?:\s+path\b|\s*\{)/gm)].map((match) => match[1]),
  ['registrationHealth', 'registrationPreflight', 'registrationPost', 'registrationSessionRead', 'registrationSessionDelete', 'purchasePublicBlocked', 'purchasePreflight', 'purchaseApi', 'webBusinessApi'],
  'CANONICAL_API_PATH_MATCHERS'
);
assertExactList(
  [...apiHost.matchAll(/reverse_proxy\s+127\.0\.0\.1:(\d+)/g)].map((match) => match[1]),
  ['4321', '4321', '4321', '4321', '4321', '4322', '4323', '4323'],
  'CANONICAL_API_PROXY_TARGETS'
);
if (['@registrationHealth', '@registrationPreflight', '@registrationPost', '@registrationSessionRead', '@registrationSessionDelete']
  .some((matcher) => apiHost.indexOf(matcher) > apiHost.indexOf('@purchaseApi'))
  || apiHost.indexOf('handle @purchasePublicBlocked') > apiHost.indexOf('handle @purchasePreflight')
  || apiHost.indexOf('handle @purchasePublicBlocked') > apiHost.indexOf('handle @purchaseApi')
  || apiHost.indexOf('handle @purchasePreflight') > apiHost.indexOf('handle @purchaseApi')
  || apiHost.indexOf('handle @purchaseApi') > apiHost.indexOf('handle @webBusinessApi')
  || apiHost.indexOf('handle @webBusinessApi') > apiHost.indexOf('respond "Not Found" 404')) {
  throw new Error('CANONICAL_API_HANDLER_ORDER_INVALID');
}
if (!/handle\s*\{\s*respond "Not Found" 404\s*\}/s.test(apiHost)) {
  throw new Error('CANONICAL_API_FALLBACK_HANDLE_MISSING');
}

const storefrontHost = slice(caddy, '\nzhudatuan.com {', '\naccounts.zhudatuan.com {');
const showcaseMatch = storefrontHost.match(/^\s*@productionShowcases path (.+)$/m);
if (!showcaseMatch) throw new Error('PRODUCTION_SHOWCASE_CADDY_MATCHER_MISSING');
assertExactSet(showcaseMatch[1].trim().split(/\s+/),
  ['/desktop-1920', '/laptop-web', '/mini-program', '/android-app', '/tablet-app'], 'PRODUCTION_SHOWCASE_PATHS');
const showcaseHandle = handleBlock(storefrontHost, 'productionShowcases');
if (!showcaseHandle.includes('respond "Not Found" 404') || /reverse_proxy|root\s|try_files|file_server|mock/i.test(showcaseHandle)) {
  throw new Error('PRODUCTION_SHOWCASE_MUST_BE_EXPLICIT_NON_MOCK');
}

const accountsHost = slice(caddy, '\naccounts.zhudatuan.com {', '\nconsole.zhudatuan.com {');
const accountsApiMatch = accountsHost.match(/^\s*@accountsApi path (.+)$/m);
if (!accountsApiMatch) throw new Error('ACCOUNTS_API_CADDY_MATCHER_MISSING');
assertExactSet(accountsApiMatch[1].trim().split(/\s+/), ['/api', '/api/*'], 'ACCOUNTS_API_PATHS');
if (!handleBlock(accountsHost, 'accountsApi').includes('respond "Not Found" 404')
  || accountsHost.indexOf('@accountsApi') > accountsHost.indexOf('\n\thandle {')) {
  throw new Error('ACCOUNTS_API_STATIC_FALLBACK_BOUNDARY_INVALID');
}

const delivery = parse(deliverySource);
if (delivery?.runtime?.canonicalApiPort !== 4321 || delivery?.runtime?.webBusinessApiPort !== 4322 || delivery?.runtime?.webBusinessApiProfile !== 'web-business-only') {
  throw new Error('WEB_BUSINESS_DELIVERY_RUNTIME_INVALID');
}
const route = delivery?.routes?.webBusinessApi;
if (
  route?.artifact !== 'services/commerce/dist/WebBusinessApiMain.js' ||
  route?.readinessArtifact !== 'services/commerce/dist/WebBusinessApiReadyMain.js' ||
  route?.process !== 'zhudatuan-web-api' ||
  route?.port !== 4322 ||
  route?.profile !== 'web-business-only'
) {
  throw new Error('WEB_BUSINESS_DELIVERY_ROUTE_INVALID');
}
assertExactSet(route?.allowedPaths ?? [], publicPaths, 'WEB_BUSINESS_DELIVERY_PATHS');

for (const token of [
  'ConditionPathExists=/opt/zhudatuan/current/services/commerce/dist/WebBusinessApiMain.js',
  'ConditionPathExists=/opt/zhudatuan/current/services/commerce/dist/WebBusinessApiReadyMain.js',
  'ConditionPathExists=/opt/zhudatuan/shared/web-business-api.env',
  'Environment=WEB_BUSINESS_API_PROFILE=web-business-only',
  'Environment=API_PORT=4322',
  'Environment=API_BIND_HOST=127.0.0.1',
  'EnvironmentFile=/opt/zhudatuan/shared/web-business-api.env',
  'ExecStart=/usr/bin/env WEB_BUSINESS_API_PROFILE=web-business-only API_PORT=4322 API_BIND_HOST=127.0.0.1 /usr/bin/node services/commerce/dist/WebBusinessApiMain.js',
  'ExecStartPost=/usr/bin/env WEB_BUSINESS_API_PROFILE=web-business-only API_PORT=4322 API_BIND_HOST=127.0.0.1 /usr/bin/node services/commerce/dist/WebBusinessApiReadyMain.js',
  'NoNewPrivileges=true',
  'ProtectSystem=strict',
  'CapabilityBoundingSet=',
  'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6',
]) {
  if (!service.includes(token)) throw new Error(`WEB_BUSINESS_SYSTEMD_TOKEN_MISSING:${token}`);
}
if (service.includes('0.0.0.0') || service.includes('EnvironmentFile=-')) {
  throw new Error('WEB_BUSINESS_SYSTEMD_FAIL_OPEN');
}

const environmentKeys = environment
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.slice(0, line.indexOf('=')));
assertExactSet(
  environmentKeys,
  ['APP_ENV', 'AUTH_MODE', 'SERVICE_VERSION', 'API_ALLOWED_ORIGINS', 'DATABASE_API_CONNECTION_REF', 'KMS_ENDPOINT', 'KMS_BEARER_TOKEN', 'SECRET_STORE_ENDPOINT', 'SECRET_STORE_BEARER_TOKEN', 'NODE_EXTRA_CA_CERTS'],
  'WEB_BUSINESS_ENVIRONMENT_KEYS'
);
if (!environment.includes('API_ALLOWED_ORIGINS=https://console.zhudatuan.com,https://zhudatuan.com')) {
  throw new Error('WEB_BUSINESS_ORIGIN_ALLOWLIST_INVALID');
}
if (!environment.includes('DATABASE_API_CONNECTION_REF=zhudatuan/web-business/database/api') || !environment.includes('NODE_EXTRA_CA_CERTS=/opt/zhudatuan/shared/tls/internal-ca.crt')) {
  throw new Error('WEB_BUSINESS_PRIVATE_DEPENDENCY_CONFIGURATION_INVALID');
}

for (const token of ["WebBusinessApiMain: 'services/commerce/src/entry/WebBusinessApiMain.ts'", "WebBusinessApiReadyMain: 'services/commerce/src/entry/WebBusinessApiReadyMain.ts'"]) {
  if (!buildSource.includes(token)) throw new Error(`WEB_BUSINESS_BUILD_ENTRY_MISSING:${token}`);
}

const baselineMarker = baselineMigrationSource.match(/values\('20260828173000','([a-f0-9]{64})'\)/)?.[1];
const schemaMarker = webBusinessMigrationSource.match(/values\('20260828180000','([a-f0-9]{64})'\)/)?.[1];
const runtimeMarker = runtimeSource.match(/WEB_BUSINESS_SCHEMA_CHECKSUM = '([a-f0-9]{64})'/)?.[1];
const sandboxMarker = sandboxPlanSource.match(/SANDBOX_CATALOG_SCHEMA_CHECKSUM = '([a-f0-9]{64})'/)?.[1];
if (!baselineMarker || baselineMarker === '0'.repeat(64)) throw new Error('WEB_BUSINESS_BASELINE_SCHEMA_MARKER_MISSING');
if (!schemaMarker || schemaMarker === '0'.repeat(64) || schemaMarker !== runtimeMarker || schemaMarker !== sandboxMarker) {
  throw new Error('WEB_BUSINESS_SCHEMA_MARKER_DRIFT');
}
if (!runtimeSource.includes("WEB_BUSINESS_SCHEMA_VERSION = '20260828180000'")
  || !runtimeSource.includes("to_regprocedure('benefit.web_ledger(text,text)')")
  || !runtimeSource.includes("has_function_privilege(current_user,'benefit.web_ledger(text,text)','EXECUTE')")) {
  throw new Error('WEB_BUSINESS_LEDGER_SCHEMA_TARGET_INVALID');
}
if (!sandboxPlanSource.includes("SANDBOX_CATALOG_SCHEMA_VERSION = '20260828180000'")) {
  throw new Error('WEB_BUSINESS_SANDBOX_SCHEMA_TARGET_INVALID');
}

const knownContractPaths = new Set(operations.map(({ path }) => path));
for (const path of contractPaths) {
  if (!knownContractPaths.has(path)) throw new Error(`WEB_BUSINESS_CONTRACT_PATH_MISSING:${path}`);
}

const closure = sourceClosure(resolve(root, 'services/commerce/src/entry/WebBusinessApiMain.ts'));
const forbiddenSourcePaths = [
  '/bootstrap/CommerceRuntime.ts',
  '/bootstrap/ProviderLoader.ts',
  '/app/modules.ts',
  '/modules/payment/',
  '/modules/finance/',
  '/modules/channel/',
  '/modules/identity/WechatOperations.ts',
  '/foundation/infrastructure/ObjectStore.ts',
  '/foundation/cache/',
];
const forbiddenClosure = [...closure].filter((file) => forbiddenSourcePaths.some((path) => file.includes(path)));
if (forbiddenClosure.length > 0) {
  throw new Error(`WEB_BUSINESS_FORBIDDEN_SOURCE_CLOSURE:${JSON.stringify(forbiddenClosure)}`);
}
for (const file of closure) {
  const source = readFileSync(file, 'utf8');
  if (source.includes('services/commerce-api') || source.includes('hbbtzn.com') || /@shop\/(?:provider|wechatpayment)/.test(source)) {
    throw new Error(`WEB_BUSINESS_FORBIDDEN_SOURCE_TOKEN:${file}`);
  }
}

console.log(`web business deployment: ${publicPaths.length} explicit Caddy paths, ${closure.size} safe sources, loopback 4322, hardened systemd`);

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

function assertExactList(actual, expected, label) {
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) {
    throw new Error(`${label}:INVALID:${JSON.stringify(sortedActual)}`);
  }
}

function assertCaddyMatcher(source, name, expectedMethods, expectedPaths) {
  const block = source.match(new RegExp(`^\\s*@${name}\\s*\\{([\\s\\S]*?)^\\s*\\}`, 'm'))?.[1];
  if (!block) throw new Error(`CADDY_MATCHER_MISSING:${name}`);
  const methods = block.match(/^\s*method\s+(.+)$/m)?.[1]?.trim().split(/\s+/) ?? [];
  const paths = block.match(/^\s*path\s+(.+)$/m)?.[1]?.trim().split(/\s+/) ?? [];
  assertExactSet(methods, expectedMethods, `${name}:METHODS`);
  assertExactSet(paths, expectedPaths, `${name}:PATHS`);
  if (paths.some((path) => path.includes('*') || path.includes('{'))) throw new Error(`${name}:NON_EXACT_PATH_FORBIDDEN`);
}

function handleBlock(source, name) {
  const block = source.match(new RegExp(`handle\\s+@${name}\\s*\\{([\\s\\S]*?)^\\s*\\}`, 'm'))?.[1];
  if (!block) throw new Error(`CADDY_HANDLE_MISSING:${name}`);
  return block;
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
