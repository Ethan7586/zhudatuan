import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { productionSources, relative, root } from './check/source.mjs';

const operations = parse(readFileSync(resolve(root, '01_core_hexin/packages/contract/definitions/operations.yml'), 'utf8')).operations;
const operationIds = new Set(operations.map(({ id }) => id));
const critical = [
  'identity.sessions.create', 'identity.session.delete', 'access.roles.manage', 'access.scopes.manage',
  'checkout.quote.create', 'order.orders.create', 'payment.intents.create',
  'payment.refunds.request', 'payment.webhooks.wechat', 'voucher.cardlibraries.create', 'voucher.redemptions.reverse',
  'finance.entries.read', 'finance.reconciliations.manage',
];
for (const id of critical) if (!operationIds.has(id)) throw new Error(`P0_OPERATION_MISSING:${id}`);

const objects = readFileSync(resolve(root, '02_platform_pingtai/database/contracts/objects.yml'), 'utf8');
for (const object of ['runtime.outbox', 'runtime.inbox', 'runtime.idempotency', 'inventory.reservation', 'payment.intent', 'payment.refund', 'finance.journal', 'finance.entry']) {
  if (!objects.includes(object)) throw new Error(`P0_DATABASE_OBJECT_MISSING:${object}`);
}
for (const path of ['01_core_hexin/services/commerce/src/entry/ApiMain.ts', '01_core_hexin/services/commerce/src/entry/JobsMain.ts', '01_core_hexin/services/commerce/src/entry/MigrationMain.ts']) {
  if (!existsSync(resolve(root, path))) throw new Error(`P0_ENTRY_MISSING:${path}`);
}
const compose = parse(readFileSync(resolve(root, '02_platform_pingtai/infrastructure/local/docker-compose.yml'), 'utf8'));
if (compose?.services?.postgres?.image !== 'postgres:17-alpine' || compose?.services?.redis?.image !== 'redis:7.4-alpine') {
  throw new Error('P0_LOCAL_DEPENDENCY_VERSION_INVALID');
}
for (const [service, port] of [['postgres', '127.0.0.1:5432:5432'], ['redis', '127.0.0.1:6379:6379']]) {
  if (!compose.services[service].ports?.includes(port)) throw new Error(`P0_LOCAL_PORT_INVALID:${service}`);
}
for (const path of [
  '04_tools/tools/localsecrets/src/Main.ts', '04_tools/tools/localkms/src/Main.ts', '04_tools/tools/localobjects/src/Main.ts',
  '04_tools/tools/seed/src/Migrate.ts', '04_tools/tools/seed/src/Seed.ts', '04_tools/tools/seed/src/Verify.ts',
]) if (!existsSync(resolve(root, path))) throw new Error(`P0_LOCAL_CONTRACT_MISSING:${path}`);
const ignored = readFileSync(resolve(root, '.gitignore'), 'utf8');
for (const value of ['.env*', 'secrets.local.json', '02_platform_pingtai/infrastructure/local/.tls/', '02_platform_pingtai/infrastructure/local/data/']) {
  if (!ignored.split(/\r?\n/).includes(value)) throw new Error(`P0_LOCAL_SECRET_NOT_IGNORED:${value}`);
}
const portContracts = new Map([
  ['01_core_hexin/apps/console/vite.config.ts', 'port: 5173'],
  ['01_core_hexin/apps/store/vite.config.ts', 'port: 5174'],
  ['01_core_hexin/apps/supplier/vite.config.ts', 'port: 5175'],
  ['01_core_hexin/apps/auth/vite.config.ts', 'port: 5176'],
  ['01_core_hexin/apps/storefront/vite.config.ts', 'port: 3000'],
]);
for (const [path, expected] of portContracts) {
  if (!readFileSync(resolve(root, path), 'utf8').includes(expected)) throw new Error(`P0_CLIENT_PORT_INVALID:${path}`);
}
for (const path of ['01_core_hexin/apps/console/.env.example', '01_core_hexin/apps/store/.env.example', '01_core_hexin/apps/supplier/.env.example', '01_core_hexin/apps/storefront/.env.example', '01_core_hexin/apps/auth/.env.example', '01_core_hexin/apps/miniapp/.env.example']) {
  if (!existsSync(resolve(root, path))) throw new Error(`P0_CLIENT_ENVIRONMENT_EXAMPLE_MISSING:${path}`);
}
const commerceExample = readFileSync(resolve(root, '01_core_hexin/services/commerce/.env.example'), 'utf8');
for (const port of [3000, 5173, 5174, 5175, 5176]) if (!commerceExample.includes(`:${port}`)) throw new Error(`P0_CORS_PORT_MISSING:${port}`);
for (const path of [
  '01_core_hexin/services/commerce/src/foundation/infrastructure/SecretStore.ts',
  '01_core_hexin/services/commerce/src/foundation/infrastructure/KmsClient.ts',
  '01_core_hexin/services/commerce/src/foundation/infrastructure/ObjectStore.ts',
]) {
  const source = readFileSync(resolve(root, path), 'utf8');
  if (/secrets\.local|LOCAL_(?:SECRETS|KMS|OBJECTS)|readFile|node:fs/.test(source)) throw new Error(`P0_PRODUCTION_CLIENT_LOCAL_BRANCH:${path}`);
}
for (const file of productionSources()) {
  const path = relative(file);
  const source = readFileSync(file, 'utf8');
  if (/(^|\/)(mock|mocks|simulation|fallback|demo)(\/|$)/i.test(path) || /@smart-wing\//.test(source)) throw new Error(`P0_PRODUCTION_SUBSTITUTE:${path}`);
}
console.log('P0 invariant spine: identity, authorization, checkout, inventory, payment, refund, outbox, and balanced finance contracts present');
