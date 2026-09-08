import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';
import { architectureDiagnostics } from '../audit/boundary.mjs';

const root = repositoryRoot;
const failures = [];
const requiredCommerceLayers = ['architecture', 'handler', 'repository', 'http', 'event', 'job'];
const providerRoot = join(root, 'extensions/channel');
const requirements = parse(readFileSync(join(root, 'config/requirements.yml'), 'utf8'));
const providerAuthority = parse(readFileSync(join(root, 'config/providers.yml'), 'utf8'));
const boundaryFixtures = parse(readFileSync(join(root, 'scripts/check/fixtures/Boundary.yml'), 'utf8'));
const operationAuthority = parse(readFileSync(join(root, 'packages/contract/definitions/operations.yml'), 'utf8'), { merge: true });
const uiRoots = ['tests/browser', 'tests/visual', 'tests/accessibility'].map((path) => join(root, path));

for (const legacy of ['tests/browser/ConsoleMock.ts', 'tests/browser/OperationMock.ts', 'tests/browser/Fixtures.ts', 'tests/browser/OrderFixtures.ts', 'tests/browser/ProductFixtures.ts']) {
  if (existsSync(join(root, legacy))) failures.push(`BROWSER_COMMERCE_MOCK_PRESENT:${legacy}`);
}
for (const file of uiRoots.flatMap((directory) => allFiles(directory)).filter((name) => /\.(?:ts|tsx)$/.test(name))) {
  if (/\bpage\.route\s*\(/.test(readFileSync(file, 'utf8'))) failures.push(`BROWSER_HTTP_MOCK_PRESENT:${short(file)}`);
}
const targetTests = [
  'tests/contract/OperationContract.test.ts', 'tests/contract/EventContract.test.ts', 'tests/contract/ErrorContract.test.ts', 'tests/contract/ExtensionContract.test.ts',
  'tests/architecture/ModuleBoundary.test.ts', 'tests/architecture/ClientBoundary.test.ts', 'tests/architecture/DependencyCycle.test.ts', 'tests/architecture/DuplicateTruth.test.ts',
  'tests/database/MigrationReplay.test.ts', 'tests/database/Ownership.test.ts', 'tests/database/Rls.test.ts', 'tests/database/Invariant.test.ts',
  'tests/integration/OutboxInbox.test.ts', 'tests/integration/ImportRuntime.test.ts', 'tests/integration/ExtensionRuntime.test.ts', 'tests/integration/Recovery.test.ts',
  'tests/performance/Checkout.test.ts', 'tests/performance/VoucherBatch.test.ts', 'tests/performance/OrderQuery.test.ts', 'tests/performance/FinanceQuery.test.ts', 'tests/performance/ImportMillion.test.ts',
  'tests/security/ScopeIsolation.test.ts', 'tests/security/Authorization.test.ts', 'tests/security/Stepup.test.ts', 'tests/security/SecretLeak.test.ts', 'tests/security/ContentSafety.test.ts',
  'tests/visual/Console.spec.ts', 'tests/visual/Storefront.spec.ts', 'tests/visual/Auth.spec.ts', 'tests/visual/Store.spec.ts', 'tests/visual/Supplier.spec.ts', 'tests/visual/Miniapp.spec.ts',
  'tests/accessibility/Keyboard.spec.ts', 'tests/accessibility/ScreenReader.spec.ts', 'tests/accessibility/Contrast.spec.ts',
  'tests/e2e/identity.spec.ts', 'tests/e2e/governance.spec.ts', 'tests/e2e/experience.spec.ts', 'tests/e2e/salechain.spec.ts', 'tests/e2e/transaction.spec.ts',
  'tests/e2e/voucher.spec.ts', 'tests/e2e/finance.spec.ts', 'tests/e2e/channel.spec.ts', 'tests/e2e/support.spec.ts', 'tests/e2e/reporting.spec.ts', 'tests/e2e/no-placeholder.spec.ts',
];
for (const required of ['tests/browser/GlobalSetup.ts', 'tests/browser/Environment.ts', 'tests/browser/RealJourneys.spec.ts', 'tools/seed/src/Visual.ts', 'tools/seed/src/Journey.ts', ...targetTests]) {
  if (!existsSync(join(root, required))) failures.push(`REAL_BROWSER_ASSET_MISSING:${required}`);
}
const visualProofs = {
  'tests/visual/Console.spec.ts': ['Object.entries(ROUTES)', 'platform', 'distributor', 'enterprise', 'mall', 'expectWcagAA'],
  'tests/visual/Storefront.spec.ts': ['Object.entries(ROUTES)', '1920', '360', '200%', 'expectWcagAA'],
  'tests/visual/Auth.spec.ts': ['Object.entries(ROUTES)', '登录', '邀请', 'expectWcagAA'],
  'tests/visual/Store.spec.ts': ['Object.entries(ROUTES)', '1024', '390', 'expectWcagAA'],
  'tests/visual/Supplier.spec.ts': ['Object.entries(ROUTES)', '1440', '768', 'expectWcagAA'],
  'tests/visual/Miniapp.spec.ts': ['MINIAPP_DEVICE_SCENARIOS', 'MINIAPP_DEVICE_EVIDENCE_REQUIRED'],
  'tests/accessibility/Keyboard.spec.ts': ['Tab', 'Escape', 'toBeFocused'],
  'tests/accessibility/ScreenReader.spec.ts': ['heading', 'aria-live', 'expectWcagAA'],
  'tests/accessibility/Contrast.spec.ts': ['200%', 'reducedMotion', 'expectWcagAA'],
};
for (const [path, proofs] of Object.entries(visualProofs)) {
  const source = existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : '';
  for (const proof of proofs) if (!source.includes(proof)) failures.push(`ROUTABLE_A11Y_MATRIX_PROOF_MISSING:${path}:${proof}`);
}

const fixtureCodes = (boundaryFixtures.cases ?? []).map(({ code }) => code);
if (JSON.stringify(fixtureCodes) !== JSON.stringify(architectureDiagnostics)) failures.push(`BOUNDARY_FIXTURE_CATALOG_INVALID:${fixtureCodes.length}`);
for (const fixture of boundaryFixtures.cases ?? []) {
  if (!fixture.positive || !fixture.negative || fixture.positive === fixture.negative) failures.push(`BOUNDARY_FIXTURE_INVALID:${fixture.code}`);
}

for (const layer of requiredCommerceLayers) {
  const directory = join(root, 'services/commerce/tests', layer);
  const files = existsSync(directory) ? readdirSync(directory).filter((name) => name.endsWith('.test.ts')) : [];
  if (files.length === 0) failures.push(`COMMERCE_TEST_LAYER_MISSING:${layer}`);
}

const operations = Array.isArray(operationAuthority?.operations) ? operationAuthority.operations : [];
const handlerPaths = new Set(operations.map(({ handler }) => handler));
if (operations.length === 0 || handlerPaths.size !== operations.length) failures.push(`HANDLER_TEST_MATRIX_CARDINALITY_INVALID:${operations.length}:${handlerPaths.size}`);
for (const operation of operations) {
  if (typeof operation?.handler !== 'string' || !existsSync(join(root, operation.handler))) failures.push(`HANDLER_TEST_TARGET_MISSING:${operation?.id ?? 'unknown'}`);
}
const handlerContractPath = join(root, 'services/commerce/tests/handler/Handler.test.ts');
const handlerContract = existsSync(handlerContractPath) ? readFileSync(handlerContractPath, 'utf8') : '';
for (const proof of ['describe.each(operations)', 'toBe(operations.length)', 'schema.input.parse', 'this.policy.authorize', 'this.idempotency', 'this.audit']) {
  if (!handlerContract.includes(proof)) failures.push(`HANDLER_TEST_MATRIX_PROOF_MISSING:${proof}`);
}

const repositoryImplementations = allFiles(join(root, 'services/commerce/src/modules')).filter(
  (name) => /\/infrastructure\/persistence\/(?:Pg|Telemetry|Extension)[A-Za-z0-9]*Repository\.ts$/.test(name) && /export class [A-Z][A-Za-z0-9]*Repository\b/.test(readFileSync(name, 'utf8'))
);
const repositoryContractPath = join(root, 'services/commerce/tests/repository/Repository.test.ts');
const repositoryContract = existsSync(repositoryContractPath) ? readFileSync(repositoryContractPath, 'utf8') : '';
for (const proof of ['describe.each(repositorySources)', 'describe.each(persistenceSources)', 'schemaOwnership(objectAuthority.objects)', 'offset', 'select', 'PoolClient|DatabasePool']) {
  if (!repositoryContract.includes(proof)) failures.push(`REPOSITORY_TEST_MATRIX_PROOF_MISSING:${proof}`);
}
if (repositoryImplementations.length === 0) failures.push('REPOSITORY_TEST_MATRIX_EMPTY');

const moduleQualityPath = join(root, 'services/commerce/tests/architecture/ModuleQuality.test.ts');
const moduleQuality = existsSync(moduleQualityPath) ? readFileSync(moduleQualityPath, 'utf8') : '';
for (const proof of [
  "toHaveLength(33)",
  "describe.each(modules)",
  "Domain-backed rejection or invariant",
  "Application use case",
  "Persistence contract",
  "every Operation",
  "Scope and permission",
  "idempotency and optimistic concurrency",
  "closed failure union",
]) {
  if (!moduleQuality.includes(proof)) failures.push(`MODULE_QUALITY_TEST_PROOF_MISSING:${proof}`);
}

const mvp = Array.isArray(requirements?.mvp) ? requirements.mvp : [];
if (mvp.length !== 22) failures.push(`MVP_REQUIREMENT_COUNT_INVALID:${mvp.length}`);
const journeyOwners = new Map();
for (const requirement of mvp) {
  const configured = Array.isArray(requirement?.journeys) ? requirement.journeys : [];
  if (configured.length !== 1) failures.push(`MVP_JOURNEY_ENTRY_INVALID:${requirement?.id ?? 'unknown'}:${configured.length}`);
  for (const path of configured) {
    const owners = journeyOwners.get(path) ?? [];
    owners.push(requirement.id);
    journeyOwners.set(path, owners);
    const absolute = join(root, path);
    if (!existsSync(absolute)) failures.push(`MVP_JOURNEY_FILE_MISSING:${requirement.id}:${path}`);
    else if (!readFileSync(absolute, 'utf8').includes(`journey('${requirement.id}'`)) failures.push(`MVP_JOURNEY_HARNESS_MISSING:${path}`);
  }
}
if (journeyOwners.size !== 22) failures.push(`MVP_JOURNEY_COUNT_INVALID:${journeyOwners.size}`);
for (const [path, owners] of journeyOwners) {
  if (owners.length !== 1) failures.push(`MVP_JOURNEY_OWNER_CONFLICT:${path}:${owners.join(',')}`);
}
const harness = readFileSync(join(root, 'tests/journey/JourneyHarness.ts'), 'utf8');
for (const evidence of ['main path', 'forbidden path', 'retry and concurrency path', 'downstream failure', 'audit and telemetry evidence', 'final database owners and invariants']) {
  if (!harness.includes(evidence)) failures.push(`MVP_EVIDENCE_ASSERTION_MISSING:${evidence}`);
}

const providers = Array.isArray(providerAuthority?.providers) ? providerAuthority.providers.map(({ id }) => id).sort() : [];
if (providers.length !== 11) failures.push(`P1_PROVIDER_COUNT_INVALID:${providers.length}`);
for (const provider of providers) {
  for (const name of ['Contract.test.ts', 'Fixture.test.ts', 'Mapping.test.ts', 'Failure.test.ts']) {
    const test = join(providerRoot, provider, 'test', name);
    if (!existsSync(test)) failures.push(`PROVIDER_CONTRACT_TEST_MISSING:${provider}:${name}`);
  }
}

const clientTests = Object.freeze({
  auth: { assembly: 'src/route/Router.test.ts', proofs: ['RouteRegistry', 'ROUTES'] },
  console: { assembly: 'src/route/Routes.test.ts', proofs: ['RouteRegistry', 'COMPONENT_KEYS'] },
  storefront: { assembly: 'src/route/Router.test.tsx', proofs: ['RouteRegistry', 'ROUTES'] },
  miniapp: { assembly: 'test/Navigation.test.ts', proofs: ['MINIAPP_PAGE_BY_ROUTE', 'ROUTES'] },
  store: { assembly: 'src/app/StoreApp.test.tsx', proofs: ['STORE_ROUTES', 'ROUTES'] },
  supplier: { assembly: 'src/app/SupplierApp.test.tsx', proofs: ['SUPPLIER_ROUTES', 'ROUTES'] },
});
for (const [app, contract] of Object.entries(clientTests)) {
  const appRoot = join(root, 'apps', app);
  const manifest = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'));
  if (typeof manifest.scripts?.['test:component'] !== 'string') failures.push(`APP_COMPONENT_SCRIPT_MISSING:${app}`);
  if (!allFiles(appRoot).some((name) => /\.test\.tsx?$/.test(name))) failures.push(`APP_COMPONENT_TEST_MISSING:${app}`);
  const assembly = join(appRoot, contract.assembly);
  const assemblySource = existsSync(assembly) ? readFileSync(assembly, 'utf8') : '';
  for (const proof of contract.proofs) if (!assemblySource.includes(proof)) failures.push(`ROUTE_ASSEMBLY_TEST_MISSING:${app}:${proof}`);
}
const matrix = join(root, 'packages/design/src/organism/ResourceState.component.test.tsx');
if (!existsSync(matrix)) failures.push('COMPONENT_STATE_MATRIX_MISSING');
else
  for (const state of ['loading', 'empty', 'denied', 'offline', 'conflict', 'stale', 'failure']) {
    if (!readFileSync(matrix, 'utf8').includes(`'${state}'`)) failures.push(`COMPONENT_STATE_MISSING:${state}`);
  }

for (const manifest of manifests(join(root, 'apps')).concat(manifests(join(root, 'services')), manifests(join(root, 'packages')), manifests(join(root, 'extensions')))) {
  const value = JSON.parse(readFileSync(manifest, 'utf8'));
  if (value.name !== '@shop/testing' && value.dependencies?.['@shop/testing']) failures.push(`PRODUCTION_TESTING_DEPENDENCY:${short(manifest)}`);
}
for (const source of productionFiles(join(root, 'apps')).concat(productionFiles(join(root, 'services')), productionFiles(join(root, 'packages')), productionFiles(join(root, 'extensions')))) {
  if (readFileSync(source, 'utf8').includes("from '@shop/testing'")) failures.push(`PRODUCTION_TESTING_IMPORT:${short(source)}`);
}

if (failures.length > 0) {
  console.error(`test topology rejected: ${failures.length}`);
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`test topology accepted: commerce=6 modules=33 categories=7 handlers=${operations.length} repositories=${repositoryImplementations.length} mvp=22 providers=11 clients=6 browserMocks=0 targetTests=${targetTests.length} productionTestingImports=0`);

function manifests(directory, result = []) {
  if (!existsSync(directory)) return result;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory() && !ignored(entry.name)) manifests(target, result);
    else if (entry.isFile() && entry.name === 'package.json') result.push(target);
  }
  return result;
}

function productionFiles(directory, result = []) {
  if (!existsSync(directory)) return result;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory() && !ignored(entry.name) && !['test', 'tests', '__tests__'].includes(entry.name)) productionFiles(target, result);
    else if (entry.isFile() && /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name)) result.push(target);
  }
  return result;
}

function ignored(name) {
  return ['dist', 'node_modules', '.next', '.open-next', 'coverage'].includes(name);
}
function short(value) {
  return relative(root, value).split('\\').join('/');
}
function allFiles(directory, result = []) {
  if (!existsSync(directory)) return result;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory() && !ignored(entry.name)) allFiles(target, result);
    else if (entry.isFile()) result.push(target);
  }
  return result;
}
