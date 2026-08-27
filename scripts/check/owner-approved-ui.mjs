import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifestPath = resolve(repositoryRoot, 'config/owner-approved-ui.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (manifest.schema !== 'zhudatuan.owner-approved-ui.v1') {
  throw new Error(`OWNER_APPROVED_UI_SCHEMA_INVALID:${String(manifest.schema)}`);
}
if (manifest.policy?.archivesAreDeployable !== false || manifest.policy?.deploymentMustUseListedEntrypoints !== true) {
  throw new Error('OWNER_APPROVED_UI_POLICY_INVALID');
}

const assertRepositoryPath = (value, label) => {
  if (typeof value !== 'string' || !value || isAbsolute(value)) throw new Error(`${label}:PATH_INVALID`);
  const absolutePath = resolve(repositoryRoot, value);
  const pathFromRoot = relative(repositoryRoot, absolutePath);
  if (pathFromRoot.startsWith('..') || pathFromRoot.includes('/archives/')) throw new Error(`${label}:PATH_OUTSIDE_MAIN`);
  return absolutePath;
};

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const sha256 = async (path) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
const domains = new Set();
let verifiedFiles = 0;

const verifyLockedFiles = async (owner, lockedFiles) => {
  for (const [file, expectedHash] of Object.entries(lockedFiles ?? {})) {
    const path = assertRepositoryPath(file, `${owner}:lockedFile`);
    if (!(await exists(path))) throw new Error(`${owner}:${file}:MISSING`);
    const actualHash = await sha256(path);
    if (actualHash !== expectedHash) {
      throw new Error(`${owner}:${file}:HASH_MISMATCH:${actualHash}`);
    }
    verifiedFiles += 1;
  }
};

for (const [surfaceName, surface] of Object.entries(manifest.surfaces ?? {})) {
  if (domains.has(surface.domain)) throw new Error(`${surfaceName}:DOMAIN_DUPLICATED`);
  domains.add(surface.domain);

  for (const key of ['workspace', 'entrypoint', 'output']) {
    const path = assertRepositoryPath(surface[key], `${surfaceName}:${key}`);
    if (key !== 'output' && !(await exists(path))) throw new Error(`${surfaceName}:${key}:MISSING`);
  }

  await verifyLockedFiles(surfaceName, surface.lockedFiles);

  if (surface.rejectedEntrypoint) {
    const rejectedPath = assertRepositoryPath(surface.rejectedEntrypoint, `${surfaceName}:rejectedEntrypoint`);
    if (await exists(rejectedPath)) throw new Error(`${surfaceName}:REJECTED_ENTRYPOINT_PRESENT`);
  }
}

const deployment = manifest.deployment;
if (!deployment || typeof deployment !== 'object') throw new Error('DEPLOYMENT_BOUNDARY_MISSING');
const deploymentPaths = {};
for (const key of ['proxyConfig', 'deliveryConfig', 'processConfig']) {
  const path = assertRepositoryPath(deployment[key], `deployment:${key}`);
  if (!(await exists(path))) throw new Error(`deployment:${key}:MISSING`);
  deploymentPaths[key] = path;
}
if (!Array.isArray(deployment.forbiddenInputs) || deployment.forbiddenInputs.includes(deployment.proxyConfig)) {
  throw new Error('deployment:forbiddenInputs:INVALID');
}
for (const migration of deployment.requiredAppliedMigrations ?? []) {
  const path = assertRepositoryPath(migration, 'deployment:requiredAppliedMigration');
  if (!(await exists(path))) throw new Error(`deployment:${migration}:MISSING`);
}
await verifyLockedFiles('deployment', deployment.lockedFiles);

const proxySource = await readFile(deploymentPaths.proxyConfig, 'utf8');
const deliverySource = await readFile(deploymentPaths.deliveryConfig, 'utf8');
const processSource = await readFile(deploymentPaths.processConfig, 'utf8');
if (!deliverySource.includes('sourceOfTruth: config/owner-approved-ui.json')) throw new Error('deployment:SOURCE_OF_TRUTH_MISSING');
for (const host of deployment.requiredHosts ?? []) {
  if (!proxySource.includes(host) || !deliverySource.includes(host)) throw new Error(`deployment:${host}:HOST_MISSING`);
}
for (const token of deployment.forbiddenRuntimeTokens ?? []) {
  if (proxySource.includes(token) || processSource.includes(token)) throw new Error(`deployment:${token}:FORBIDDEN_RUNTIME_TOKEN`);
}
if (deliverySource.includes('hbbtzn.com')) throw new Error('deployment:LEGACY_DOMAIN_PRESENT');

if (verifiedFiles === 0) throw new Error('OWNER_APPROVED_UI_LOCK_EMPTY');
console.log(`Owner-approved UI manifest verified: ${Object.keys(manifest.surfaces).length} surfaces, ${verifiedFiles} locked files.`);
