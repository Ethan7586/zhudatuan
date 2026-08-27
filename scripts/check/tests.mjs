import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

const root = repositoryRoot;
const failures = [];
const requiredCommerceLayers = ['repository', 'http', 'event', 'job'];
const journeyNames = Array.from({ length: 21 }, (_, index) => `mvp${String(index + 3).padStart(2, '0')}`);
const providerRoot = join(root, 'extensions/providers');

for (const layer of requiredCommerceLayers) {
  const directory = join(root, 'services/commerce/tests', layer);
  const files = existsSync(directory) ? readdirSync(directory).filter((name) => name.endsWith('.test.ts')) : [];
  if (files.length === 0) failures.push(`COMMERCE_TEST_LAYER_MISSING:${layer}`);
}

const journeys = readdirSync(join(root, 'tests/journeys')).filter((name) => /^mvp\d{2}_.+\.spec\.ts$/.test(name)).sort();
if (journeys.length !== 21) failures.push(`MVP_JOURNEY_COUNT_INVALID:${journeys.length}`);
for (const id of journeyNames) {
  const matches = journeys.filter((name) => name.startsWith(`${id}_`));
  if (matches.length !== 1) failures.push(`MVP_JOURNEY_ENTRY_INVALID:${id}:${matches.length}`);
  else if (!readFileSync(join(root, 'tests/journeys', matches[0]), 'utf8').includes(`journey('MVP${id.slice(3)}`)) failures.push(`MVP_JOURNEY_HARNESS_MISSING:${matches[0]}`);
}
const harness = readFileSync(join(root, 'tests/journeys/JourneyHarness.ts'), 'utf8');
for (const evidence of ['main path', 'forbidden path', 'retry and concurrency path', 'downstream failure', 'audit and telemetry evidence', 'final database owners and invariants']) {
  if (!harness.includes(evidence)) failures.push(`MVP_EVIDENCE_ASSERTION_MISSING:${evidence}`);
}

const providers = readdirSync(providerRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'core')
  .map(({ name }) => name).sort();
if (providers.length !== 11) failures.push(`P1_PROVIDER_COUNT_INVALID:${providers.length}`);
for (const provider of providers) {
  const test = join(providerRoot, provider, 'tests/Provider.test.ts');
  if (!existsSync(test)) failures.push(`PROVIDER_CONTRACT_TEST_MISSING:${provider}`);
}

for (const app of ['auth', 'console', 'store', 'storefront', 'supplier', 'miniapp']) {
  const manifest = JSON.parse(readFileSync(join(root, 'apps', app, 'package.json'), 'utf8'));
  if (typeof manifest.scripts?.['test:component'] !== 'string') failures.push(`APP_COMPONENT_SCRIPT_MISSING:${app}`);
  if (app !== 'miniapp' && !allFiles(join(root, 'apps', app, 'src')).some((name) => name.endsWith('.test.tsx'))) failures.push(`APP_COMPONENT_TEST_MISSING:${app}`);
}
const matrix = join(root, 'packages/design/src/ResourceState.component.test.tsx');
if (!existsSync(matrix)) failures.push('COMPONENT_STATE_MATRIX_MISSING');
else for (const state of ['loading', 'empty', 'denied', 'offline', 'conflict', 'stale', 'failure']) {
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
console.log('test topology accepted: commerce=4 mvp=21 providers=11 clients=6 productionTestingImports=0');

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

function ignored(name) { return ['dist', 'node_modules', '.next', '.open-next', 'coverage'].includes(name); }
function short(value) { return relative(root, value).split('\\').join('/'); }
function allFiles(directory, result = []) {
  if (!existsSync(directory)) return result;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory() && !ignored(entry.name)) allFiles(target, result);
    else if (entry.isFile()) result.push(target);
  }
  return result;
}
