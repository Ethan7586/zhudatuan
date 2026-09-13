import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { resolvePackageArtifactPaths } from './artifact.mjs';
import { invariant } from './errors.mjs';
import { digest, prettyStableJson, sha256 } from './stable.mjs';

export async function verifyReproducibilityCommand(_adapter, options) {
  const left = await loadColdPackage(options.leftPackage, 'LEFT');
  const right = await loadColdPackage(options.rightPackage, 'RIGHT');
  invariant(left.packageSet.stateRoot !== right.packageSet.stateRoot, 'REPRODUCIBILITY_STATE_ROOT_REUSED', 'Cold Prepare runs must use different state roots');
  invariant(left.packageSet.sourceSha === right.packageSet.sourceSha, 'REPRODUCIBILITY_SOURCE_MISMATCH', 'Cold Prepare source SHAs differ');
  invariant(left.artifact.target === right.artifact.target, 'REPRODUCIBILITY_TARGET_MISMATCH', 'Cold Prepare targets differ');

  const comparisons = {
    treeDigest: left.artifact.treeDigest === right.artifact.treeDigest,
    manifestDigest: left.artifact.manifestDigest === right.artifact.manifestDigest,
    archiveSha256: left.artifact.archive.sha256 === right.artifact.archive.sha256,
    archiveBytes: left.artifact.archive.bytes === right.artifact.archive.bytes,
    fileList: JSON.stringify(left.manifest.entries) === JSON.stringify(right.manifest.entries),
  };
  invariant(Object.values(comparisons).every(Boolean), 'REPRODUCIBILITY_MISMATCH', 'Independent cold Prepare outputs differ', { comparisons });
  const result = {
    schema: 'ai.delivery.reproducibility.v1',
    sourceSha: left.packageSet.sourceSha,
    target: left.artifact.target,
    isolatedStateRoots: true,
    coldPackageCaches: [left.artifact.packageCache, right.artifact.packageCache],
    comparisons,
    treeDigest: left.artifact.treeDigest,
    manifestDigest: left.artifact.manifestDigest,
    archive: { sha256: left.artifact.archive.sha256, bytes: left.artifact.archive.bytes },
    fileList: { entries: left.manifest.entries.length, digest: digest(left.manifest.entries) },
    runs: [summarize(left), summarize(right)],
  };
  if (options.output) {
    const output = resolve(options.output);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, prettyStableJson(result));
  }
  return result;
}

async function loadColdPackage(path, side) {
  const packagePath = resolve(required(path, `REPRODUCIBILITY_${side}_PACKAGE_REQUIRED`));
  const raw = JSON.parse(await readFile(packagePath, 'utf8'));
  const packageSet = await resolvePackageArtifactPaths(packagePath, raw);
  invariant(packageSet.prepare === true && packageSet.artifacts?.length === 1, `REPRODUCIBILITY_${side}_PACKAGE_INVALID`, 'Reproducibility input must be one Prepare artifact');
  invariant(typeof packageSet.stateRoot === 'string' && resolve(packageSet.stateRoot) === packageSet.stateRoot, `REPRODUCIBILITY_${side}_STATE_ROOT_INVALID`, 'Prepare package must record its absolute state root');
  const artifact = packageSet.artifacts[0];
  invariant(artifact.packageCache === 'miss', `REPRODUCIBILITY_${side}_CACHE_NOT_COLD`, 'Each independent Prepare package must be a cold cache miss');
  const archive = await readFile(artifact.archive.path);
  invariant(archive.byteLength === artifact.archive.bytes && `sha256:${sha256(archive)}` === artifact.archive.sha256, `REPRODUCIBILITY_${side}_ARCHIVE_INVALID`, 'Prepare archive bytes or digest differ from its manifest');
  const manifest = JSON.parse(await readFile(artifact.manifestPath, 'utf8'));
  invariant(Array.isArray(manifest.entries) && digest(manifest.entries) === manifest.treeDigest, `REPRODUCIBILITY_${side}_FILE_LIST_INVALID`, 'Prepare file list digest is invalid');
  return { packagePath, packageSet, artifact, manifest };
}

function summarize(value) {
  return {
    runId: value.packageSet.runId,
    stateRoot: value.packageSet.stateRoot,
    packageCache: value.artifact.packageCache,
    treeDigest: value.artifact.treeDigest,
    manifestDigest: value.artifact.manifestDigest,
    archive: { sha256: value.artifact.archive.sha256, bytes: value.artifact.archive.bytes },
    fileListDigest: digest(value.manifest.entries),
  };
}

function required(value, code) {
  invariant(typeof value === 'string' && value.length > 0, code, `${code} is required`);
  return value;
}
