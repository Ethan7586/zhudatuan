import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import {
  FULL_ROOT,
  canonical,
  digest,
  digestFile,
  matchEvidence,
  publicStagingHost,
  record,
  valueAt,
} from './readiness-common.mjs';

export async function verifyLiveCandidate(evidence, observed) {
  const missing = [];
  try {
    const commit = valueAt(evidence, 'candidate.commit');
    const release = await candidateOrCurrentRelease(commit);
    const manifestFile = `${release}/.zhudatuan-staging-release.json`;
    const [manifestSource] = await Promise.all([
      readFile(manifestFile, 'utf8'),
    ]);
    const manifest = JSON.parse(manifestSource);
    if (!record(manifest) || canonical(Object.keys(manifest).sort()) !== canonical(['build', 'commit', 'fileCount', 'generatedAt', 'schema', 'treeState'])
      || manifest.schema !== 'zhudatuan.staging.release.v2' || manifest.commit !== commit || manifest.treeState !== 'clean'
      || !Number.isSafeInteger(manifest.fileCount) || manifest.fileCount < 1 || !Number.isFinite(Date.parse(manifest.generatedAt))) {
      throw new Error('CANDIDATE_MANIFEST_INVALID');
    }
    validateBuildReceipt(manifest.build);
    const inventorySource = await verifyReleaseInventory(release, manifest.fileCount);
    const archiveFile = `${FULL_ROOT}/archives/${commit}.tar.gz`;
    const archiveInformation = await lstat(archiveFile);
    if (!archiveInformation.isFile() || archiveInformation.isSymbolicLink()) throw new Error('CANDIDATE_ARCHIVE_INVALID');
    matchEvidence(evidence, 'candidate.commit', manifest.commit, missing, observed);
    matchEvidence(evidence, 'candidate.archiveSha256', await digestFile(archiveFile), missing, observed);
    matchEvidence(evidence, 'candidate.inventorySha256', digest(inventorySource), missing, observed);
    if (valueAt(evidence, 'candidate.treeState') !== manifest.treeState) missing.push('live:candidate.treeState:mismatch');
  } catch {
    missing.push('live:candidate:integrity');
  }
  return missing;
}

export async function verifyCurrentReleaseIdentity(evidence) {
  const commit = valueAt(evidence, 'candidate.commit');
  const release = await checkedRelease('current', commit);
  const manifest = JSON.parse(await readFile(`${release}/.zhudatuan-staging-release.json`, 'utf8'));
  if (!record(manifest) || canonical(Object.keys(manifest).sort()) !== canonical(['build', 'commit', 'fileCount', 'generatedAt', 'schema', 'treeState'])
    || manifest.schema !== 'zhudatuan.staging.release.v2' || manifest.commit !== commit || manifest.treeState !== 'clean'
    || !Number.isSafeInteger(manifest.fileCount) || manifest.fileCount < 1 || !Number.isFinite(Date.parse(manifest.generatedAt))) {
    throw new Error('CURRENT_RELEASE_MANIFEST_INVALID');
  }
  validateBuildReceipt(manifest.build);
  const inventorySource = await verifyReleaseInventory(release, manifest.fileCount);
  if (digest(inventorySource) !== valueAt(evidence, 'candidate.inventorySha256')) {
    throw new Error('CURRENT_RELEASE_INVENTORY_RECEIPT_INVALID');
  }
  const expectedHosts = {
    accounts: valueAt(evidence, 'runtime.accountsHost'),
    api: valueAt(evidence, 'runtime.apiHost'),
    console: valueAt(evidence, 'runtime.consoleHost'),
  };
  if (canonical(manifest.build.hosts) !== canonical(expectedHosts)) throw new Error('CURRENT_RELEASE_HOST_RECEIPT_INVALID');
}

async function verifyReleaseInventory(release, expectedCount) {
  const inventorySource = await readFile(`${release}/.zhudatuan-staging-inventory.sha256`, 'utf8');
  const lines = inventorySource.trimEnd().split('\n');
  if (lines.length !== expectedCount) throw new Error('CANDIDATE_INVENTORY_COUNT_INVALID');
  const seen = new Set();
  for (const line of lines) {
    const match = /^([a-f0-9]{64})  ([^\0]+)$/u.exec(line);
    if (!match || match[2].startsWith('/') || match[2].includes('\\')
      || match[2].split('/').some((part) => part === '..' || part === '.') || seen.has(match[2])) {
      throw new Error('CANDIDATE_INVENTORY_INVALID');
    }
    seen.add(match[2]);
    const file = resolve(release, match[2]);
    if (!file.startsWith(`${release}/`)) throw new Error('CANDIDATE_INVENTORY_PATH_INVALID');
    await assertReleaseNode(file, false);
    if (digest(await readFile(file)) !== match[1]) throw new Error('CANDIDATE_ARTIFACT_DIGEST_INVALID');
  }
  const actual = await regularReleaseFiles(release);
  const expected = [...seen, '.zhudatuan-staging-inventory.sha256'].sort();
  if (canonical(actual) !== canonical(expected)) throw new Error('CANDIDATE_UNINVENTORIED_ARTIFACT');
  return inventorySource;
}

async function regularReleaseFiles(root) {
  const files = [];
  async function visit(directory) {
    await assertReleaseNode(directory, true);
    for (const entry of (await readdir(directory)).sort()) {
      const path = resolve(directory, entry);
      const information = await lstat(path);
      if (information.isDirectory() && !information.isSymbolicLink()) await visit(path);
      else {
        await assertReleaseNode(path, false);
        files.push(relative(root, path));
      }
    }
  }
  await visit(root);
  return files.sort();
}

async function assertReleaseNode(path, directory) {
  const information = await lstat(path);
  const mode = information.mode & 0o777;
  if (information.isSymbolicLink() || information.uid !== 0 || information.gid !== 0
    || directory !== information.isDirectory() || mode & 0o022
    || !directory && !information.isFile()) throw new Error('CANDIDATE_FILE_BOUNDARY_INVALID');
}

async function candidateOrCurrentRelease(commit) {
  try {
    await lstat(`${FULL_ROOT}/candidate`);
  } catch (cause) {
    if (cause?.code !== 'ENOENT') throw cause;
    return checkedRelease('current', commit);
  }
  return checkedRelease('candidate', commit);
}

async function checkedRelease(name, commit) {
  const path = `${FULL_ROOT}/${name}`;
  const [link, release] = await Promise.all([lstat(path), realpath(path)]);
  if (!link.isSymbolicLink() || release !== `${FULL_ROOT}/releases/${commit}`) {
    throw new Error(`${name.toUpperCase()}_LINK_INVALID`);
  }
  return release;
}

function validateBuildReceipt(build) {
  if (!record(build) || canonical(Object.keys(build).sort()) !== canonical([
    'commands', 'hosts', 'lockfileSha256', 'nodeBinarySha256', 'nodeVersion', 'npmCliSha256', 'solutionOrigin',
  ])
    || canonical(build.commands) !== canonical(['npm run build:auth', 'npm run build:console', 'npm run build:commerce'])
    || ![build.lockfileSha256, build.nodeBinarySha256, build.npmCliSha256].every((value) => /^[a-f0-9]{64}$/u.test(value))
    || !/^v\d+\.\d+\.\d+/u.test(build.nodeVersion)
    || build.solutionOrigin !== 'https://disabled.full.staging.example.invalid'
    || !record(build.hosts) || canonical(Object.keys(build.hosts).sort()) !== canonical(['accounts', 'api', 'console'])
    || !Object.values(build.hosts).every(publicStagingHost) || new Set(Object.values(build.hosts)).size !== 3) {
    throw new Error('RELEASE_BUILD_RECEIPT_INVALID');
  }
}
