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
<<<<<<< HEAD
const sourceSliceHash = async (path, startMarker, endMarker) => {
  const source = await readFile(path, 'utf8');
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${path}:VISUAL_SLICE_START_MISSING`);
  const end = endMarker === undefined ? source.length : source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${path}:VISUAL_SLICE_END_MISSING`);
  return createHash('sha256').update(source.slice(start, end)).digest('hex');
};
=======
>>>>>>> e29ce3d6 (fix: lock owner-approved zhudatuan UI baseline)
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

<<<<<<< HEAD
const verifyVisualSlices = async (owner, visualSlices) => {
  for (const [file, slice] of Object.entries(visualSlices ?? {})) {
    const path = assertRepositoryPath(file, `${owner}:visualSlice`);
    if (!(await exists(path))) throw new Error(`${owner}:${file}:MISSING`);
    if (slice === null || typeof slice !== 'object' || typeof slice.startMarker !== 'string' || slice.startMarker.length === 0 || typeof slice.sha256 !== 'string' || (slice.endMarker !== undefined && typeof slice.endMarker !== 'string')) {
      throw new Error(`${owner}:${file}:VISUAL_SLICE_INVALID`);
    }
    const actualHash = await sourceSliceHash(path, slice.startMarker, slice.endMarker);
    if (actualHash !== slice.sha256) throw new Error(`${owner}:${file}:VISUAL_SLICE_HASH_MISMATCH:${actualHash}`);
    verifiedFiles += 1;
  }
};

=======
>>>>>>> e29ce3d6 (fix: lock owner-approved zhudatuan UI baseline)
for (const [surfaceName, surface] of Object.entries(manifest.surfaces ?? {})) {
  if (domains.has(surface.domain)) throw new Error(`${surfaceName}:DOMAIN_DUPLICATED`);
  domains.add(surface.domain);

  for (const key of ['workspace', 'entrypoint', 'output']) {
    const path = assertRepositoryPath(surface[key], `${surfaceName}:${key}`);
    if (key !== 'output' && !(await exists(path))) throw new Error(`${surfaceName}:${key}:MISSING`);
  }

  await verifyLockedFiles(surfaceName, surface.lockedFiles);
<<<<<<< HEAD
  await verifyVisualSlices(surfaceName, surface.visualSlices);
=======
>>>>>>> e29ce3d6 (fix: lock owner-approved zhudatuan UI baseline)

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
<<<<<<< HEAD
const registrationServiceSource = await readFile(resolve(repositoryRoot, 'infrastructure/zhudatuan/aliyun/systemd/zhudatuan-api.service'), 'utf8');
const webBusinessServiceSource = await readFile(resolve(repositoryRoot, 'infrastructure/zhudatuan/aliyun/systemd/zhudatuan-web-api.service'), 'utf8');
const identityNotificationServiceSource = await readFile(resolve(repositoryRoot, 'infrastructure/zhudatuan/aliyun/systemd/zhudatuan-identity-notification-jobs.service'), 'utf8');
=======
>>>>>>> e29ce3d6 (fix: lock owner-approved zhudatuan UI baseline)
if (!deliverySource.includes('sourceOfTruth: config/owner-approved-ui.json')) throw new Error('deployment:SOURCE_OF_TRUTH_MISSING');
for (const host of deployment.requiredHosts ?? []) {
  if (!proxySource.includes(host) || !deliverySource.includes(host)) throw new Error(`deployment:${host}:HOST_MISSING`);
}
for (const token of deployment.forbiddenRuntimeTokens ?? []) {
  if (proxySource.includes(token) || processSource.includes(token)) throw new Error(`deployment:${token}:FORBIDDEN_RUNTIME_TOKEN`);
}
if (deliverySource.includes('hbbtzn.com')) throw new Error('deployment:LEGACY_DOMAIN_PRESENT');
<<<<<<< HEAD
if (!proxySource.includes('reverse_proxy 127.0.0.1:4321')) throw new Error('deployment:CANONICAL_API_ROUTE_MISSING');
if (!proxySource.includes('reverse_proxy 127.0.0.1:4322')) throw new Error('deployment:WEB_BUSINESS_API_ROUTE_MISSING');
if (
  !registrationServiceSource.includes('Environment=API_PORT=4321') ||
  !registrationServiceSource.includes('Environment=API_BIND_HOST=127.0.0.1') ||
  !registrationServiceSource.includes('ExecStart=/usr/bin/node services/commerce/dist/IdentityRegistrationApiMain.js')
) {
  throw new Error('deployment:CANONICAL_API_LOOPBACK_MISSING');
}
if (
  !webBusinessServiceSource.includes('Environment=WEB_BUSINESS_API_PROFILE=web-business-only') ||
  !webBusinessServiceSource.includes('Environment=API_PORT=4322') ||
  !webBusinessServiceSource.includes('Environment=API_BIND_HOST=127.0.0.1') ||
  !webBusinessServiceSource.includes('ExecStart=/usr/bin/env WEB_BUSINESS_API_PROFILE=web-business-only API_PORT=4322 API_BIND_HOST=127.0.0.1 /usr/bin/node services/commerce/dist/WebBusinessApiMain.js')
) {
  throw new Error('deployment:WEB_BUSINESS_API_LOOPBACK_MISSING');
}
if (!identityNotificationServiceSource.includes('Environment=JOB_RUNTIME_PROFILE=identity-notification-only')) {
  throw new Error('deployment:IDENTITY_NOTIFICATION_PROFILE_MISSING');
}
for (const forbiddenEndpoint of ['localhost:3000', 'localhost:3001', '127.0.0.1:3000', '127.0.0.1:3001']) {
  if (proxySource.includes(forbiddenEndpoint)) throw new Error(`deployment:${forbiddenEndpoint}:LEGACY_ENDPOINT_PRESENT`);
}
if (!deliverySource.includes('publicCutoverRequiresRealSmsReceipt: true') || !deliverySource.includes('publicCutoverRequiresRegistrationE2e: true')
  || !deliverySource.includes('publicCutoverRequiresWebBusinessE2e: true') || !deliverySource.includes('publicCutoverRequiresPurchaseE2e: true')
  || !deliverySource.includes('publicCutover: blocked') || !deliverySource.includes('purchaseE2eReceipt: null')) {
  throw new Error('deployment:REGISTRATION_CUTOVER_GATES_MISSING');
}
=======
>>>>>>> e29ce3d6 (fix: lock owner-approved zhudatuan UI baseline)

if (verifiedFiles === 0) throw new Error('OWNER_APPROVED_UI_LOCK_EMPTY');
console.log(`Owner-approved UI manifest verified: ${Object.keys(manifest.surfaces).length} surfaces, ${verifiedFiles} locked files.`);
