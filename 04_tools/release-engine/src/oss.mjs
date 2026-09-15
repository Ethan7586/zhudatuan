import { createHash, createHmac } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { resolvePackageArtifactPaths } from './artifact.mjs';
import { resolveStaticAccessKeyCredentials } from './credential-provider.mjs';
import { DeliveryError, invariant } from './errors.mjs';
import { createSealKey, createSealLifecycleStore, sealObjectPaths } from './seal-lifecycle.mjs';
import { classifySealCheckpoint } from './seal-recovery.mjs';
import { isTransientNetworkFailure, withFiniteRetry } from './retry.mjs';
import { digest, prettyStableJson, sha256 } from './stable.mjs';

const DEFAULT_PREFIX = '';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SOURCE_SHA_PATTERN = /^[a-f0-9]{40}$/;
const STOREFRONT_RUNTIME_NODE = 'v22.22.0';
const ARTIFACT_RECIPE = 'r4-seal-lifecycle';
const CURRENT_RELEASE_INDEX = `release-index-${ARTIFACT_RECIPE}.json`;
const PREVIOUS_RELEASE_INDEX = 'release-index-r3-normalized-runtime-modes.json';
const LEGACY_RELEASE_INDEX = 'release-index.json';

export function releaseIndexObjectPath(project, target, sourceSha, prefix = '') {
  exactSourceSha(sourceSha, 'OSS_SOURCE_SHA_INVALID');
  return `${objectRoot(project, target, sourceSha, prefix)}/${CURRENT_RELEASE_INDEX}`;
}

export async function publishPreparedArtifact(adapter, options, dependencies = {}) {
  const started = performance.now();
  const sourceSha = exactSourceSha(options.sourceSha, 'PREPARE_SOURCE_SHA_INVALID');
  const target = exactTarget(adapter, options.target, 'PREPARE_TARGET');
  const node = required(options.node, 'PREPARE_NODE_REQUIRED');
  invariant(Boolean(adapter.nodes[node]?.deployments?.[target]), 'PREPARE_NODE_TARGET_MISMATCH', `Unknown deployment ${node}/${target}`);
  const controlSha = exactSourceSha(options.controlSha, 'PREPARE_CONTROL_SHA_INVALID');
  const requestId = required(options.requestId, 'PREPARE_REQUEST_ID_REQUIRED');
  const buildRunner = required(options.buildRunner, 'PREPARE_BUILD_RUNNER_REQUIRED');
  invariant(options.actorRole === 'build', 'PREPARE_ROLE_FORBIDDEN', 'Only the Build role may publish prepared artifacts');
  const routing = {
    request_id: requestId,
    selected_runner_class: required(options.runnerClass, 'PREPARE_RUNNER_CLASS_REQUIRED'),
    selected_runner_name: buildRunner,
    lease_generation: positiveInteger(options.leaseGeneration, 'PREPARE_RUNNER_LEASE_GENERATION_INVALID'),
    lease_expires_at: exactTimestamp(options.leaseExpiresAt, 'PREPARE_RUNNER_LEASE_EXPIRY_INVALID'),
    overflow_reason: options.overflowReason === 'none' ? null : options.overflowReason ?? null,
    retry_count: nonnegativeInteger(options.retryCount ?? 0, 'PREPARE_RUNNER_RETRY_COUNT_INVALID'),
    build_host: required(options.buildHost, 'PREPARE_BUILD_HOST_REQUIRED'),
    reused_existing_task: options.reusedExistingTask === 'true' || options.reusedExistingTask === true,
  };
  invariant(['aliyun', 'github'].includes(routing.selected_runner_class), 'PREPARE_RUNNER_CLASS_INVALID', 'Prepared artifact must record Aliyun or GitHub Runner class');
  const packagePath = resolve(required(options.package, 'PREPARE_PACKAGE_REQUIRED'));
  const packageSet = await resolvePackageArtifactPaths(packagePath, JSON.parse(await readFile(packagePath, 'utf8')));
  invariant(packageSet.project === adapter.project, 'PREPARE_PROJECT_MISMATCH', 'Package belongs to another project');
  invariant(packageSet.sourceSha === sourceSha, 'PREPARE_SOURCE_SHA_MISMATCH', 'Package source SHA does not match the requested source SHA');
  invariant(packageSet.prepare === true, 'PREPARE_PACKAGE_MODE_INVALID', 'Only a Prepare Artifact package can be published');
  invariant(packageSet.artifacts?.length === 1 && packageSet.artifacts[0].target === target, 'PREPARE_TARGET_SCOPE_INVALID', 'Prepare Artifact publishes exactly one target');

  const artifact = packageSet.artifacts[0];
  const archive = await readFile(artifact.archive.path);
  const archiveSha256 = sha256(archive);
  invariant(artifact.archive.sha256 === `sha256:${archiveSha256}`, 'PREPARE_ARCHIVE_HASH_MISMATCH', 'Packaged archive hash differs');
  invariant(artifact.archive.bytes === archive.byteLength, 'PREPARE_ARCHIVE_BYTES_MISMATCH', 'Packaged archive size differs');
  const runtimeManifestBody = await readFile(artifact.manifestPath);
  const runtimeManifestSha256 = sha256(runtimeManifestBody);
  const runtimeManifest = JSON.parse(runtimeManifestBody.toString('utf8'));
  validateRuntimeManifest(runtimeManifest, { project: adapter.project, target, sourceSha, artifact });

  const runDirectory = dirname(packagePath);
  const plan = JSON.parse(await readFile(resolve(runDirectory, 'plan.json'), 'utf8'));
  const build = JSON.parse(await readFile(resolve(runDirectory, 'build.json'), 'utf8'));
  invariant(plan.prepare === true && plan.to?.sha === sourceSha, 'PREPARE_PLAN_INVALID', 'Prepare plan provenance differs');
  invariant(build.sourceSha === sourceSha && build.planDigest === plan.planDigest, 'PREPARE_BUILD_INVALID', 'Prepare build provenance differs');
  const lockfileSha256 = sha256(await readFile(resolve(adapter.projectRoot, 'package-lock.json')));
  const prefix = objectPrefix(adapter.project, target, sourceSha, archiveSha256, options.prefix);
  const archiveObject = `${prefix}/artifact-${archiveSha256}.tar.gz`;
  const runtimeManifestObject = `${prefix}/artifact-manifest-${runtimeManifestSha256}.json`;
  const buildEnvironment = {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    npm: required(options.npmVersion ?? process.env.AI_DELIVERY_NPM_VERSION, 'PREPARE_NPM_VERSION_REQUIRED'),
    runnerImage: options.runnerImage ?? process.env.ImageOS ?? `${process.platform}-${process.arch}`,
    runner: buildRunner,
    releaseEngine: 2,
    artifactRecipe: ARTIFACT_RECIPE,
  };
  const sourceEvidence = {
    repository: options.repository ?? process.env.GITHUB_REPOSITORY ?? adapter.project,
    sourceSha,
    parentSha: plan.from?.sha ?? null,
    planDigest: plan.planDigest,
    packageLockSha256: `sha256:${lockfileSha256}`,
  };
  const validations = normalizedValidations(build.phases);
  const runtimeVerification = await normalizedRuntimeVerification(options.runtimeEvidence, target);
  const provenanceUnsigned = {
    schema: 'ai.delivery.build-provenance.v1', protocolVersion: 1, project: adapter.project, target, sourceSha, controlPlaneSha: controlSha,
    artifact: { object: archiveObject, sha256: artifact.archive.sha256, bytes: artifact.archive.bytes, treeDigest: artifact.treeDigest },
    runtimeManifest: { object: runtimeManifestObject, sha256: `sha256:${runtimeManifestSha256}`, manifestDigest: artifact.manifestDigest },
    buildEnvironment, sourceEvidence, validations, runtimeVerification,
  };
  const provenance = { ...provenanceUnsigned, provenanceDigest: digest(provenanceUnsigned) };
  const provenanceBody = Buffer.from(prettyStableJson(provenance));
  const provenanceSha256 = sha256(provenanceBody);
  const provenanceObject = `${prefix}/build-provenance-${provenanceSha256}.json`;
  const releaseManifestUnsigned = {
    schema: 'ai.delivery.oss-release.v1',
    protocolVersion: 1,
    project: adapter.project,
    target,
    sourceSha,
    eligibleNodes: eligibleNodes(adapter, target),
    artifact: {
      object: archiveObject,
      sha256: artifact.archive.sha256,
      bytes: artifact.archive.bytes,
      treeDigest: artifact.treeDigest,
    },
    runtimeManifest: {
      object: runtimeManifestObject,
      sha256: `sha256:${runtimeManifestSha256}`,
      bytes: runtimeManifestBody.byteLength,
      manifestDigest: artifact.manifestDigest,
    },
    provenance: { object: provenanceObject, sha256: `sha256:${provenanceSha256}`, provenanceDigest: provenance.provenanceDigest },
    buildEnvironment,
    sourceEvidence,
    validations,
    runtimeVerification,
    dependencyCache: {
      role: 'build-acceleration-only',
      deployableArtifact: false,
      identityAuthority: false,
    },
    retention: {
      mode: 'immutable-no-overwrite',
      automaticDeletion: 'disabled-until-current-and-rollback-pins-are-reconciled',
      minimumRollbackReleasesPerNode: 2,
      recommendedMinimumDays: 90,
    },
  };
  const releaseManifest = { ...releaseManifestUnsigned, manifestDigest: digest(releaseManifestUnsigned) };
  const releaseManifestBody = Buffer.from(prettyStableJson(releaseManifest));
  const releaseManifestSha256 = sha256(releaseManifestBody);
  const releaseManifestObject = `${prefix}/release-manifest-${releaseManifestSha256}.json`;
  const releaseIndexUnsigned = {
    schema: 'ai.delivery.oss-release-index.v1',
    protocolVersion: 1,
    project: adapter.project,
    target,
    sourceSha,
    artifactRecipe: ARTIFACT_RECIPE,
    artifactIdentity: artifact.archive.sha256,
    releaseManifest: {
      object: releaseManifestObject,
      sha256: `sha256:${releaseManifestSha256}`,
      manifestDigest: releaseManifest.manifestDigest,
    },
  };
  const releaseIndex = { ...releaseIndexUnsigned, indexDigest: digest(releaseIndexUnsigned) };
  const releaseIndexBody = Buffer.from(prettyStableJson(releaseIndex));
  const releaseIndexSha256 = sha256(releaseIndexBody);
  const releaseIndexObject = `${objectRoot(adapter.project, target, sourceSha, options.prefix)}/${CURRENT_RELEASE_INDEX}`;
  const client = dependencies.client ?? ossClientFromEnvironment(options.endpoint, dependencies);

  const publicationStarted = performance.now();
  const objects = [
    await client.putImmutable(archiveObject, archive, 'application/gzip'),
    await client.putImmutable(runtimeManifestObject, runtimeManifestBody, 'application/json'),
    await client.putImmutable(provenanceObject, provenanceBody, 'application/json'),
    await client.putImmutable(releaseManifestObject, releaseManifestBody, 'application/json'),
    await client.putImmutable(releaseIndexObject, releaseIndexBody, 'application/json'),
  ];
  const lifecycles = [];
  for (const physicalNode of eligibleNodes(adapter, target)) {
    const lifecycle = createSealLifecycleStore(client, {
      project: adapter.project, sourceSha, releaseTarget: target, physicalNode,
      artifactDigest: artifact.archive.sha256, controlPlaneSha: controlSha,
    });
    const begun = await lifecycle.begin({ requestId, actorRole: 'build' });
    invariant(begun.action !== 'observe', 'SEAL_BUILD_IN_PROGRESS', 'Another request owns the active Seal build lease', {
      sealKey: lifecycle.key.seal_key, ownerRequestId: begun.lease?.request_id, retryable: true,
    });
    const uploaded = await lifecycle.markUploaded({
      requestId, actorRole: 'build', buildRunner, routing,
      artifact: { object: archiveObject, digest: artifact.archive.sha256, bytes: artifact.archive.bytes, releaseManifestObject },
      provenance: { object: provenanceObject, digest: `sha256:${provenanceSha256}` },
      reused: objects.every((item) => item.status === 'hit_remote'),
    });
    lifecycles.push({ lifecycle, uploaded });
  }
  const requestedLifecycle = lifecycles.find(({ lifecycle }) => lifecycle.key.physical_node === node);
  invariant(requestedLifecycle, 'PREPARE_PHYSICAL_NODE_INVALID', 'Prepare node is not a physical artifact placement');
  const publicationMs = elapsed(publicationStarted);
  const uploadedBytes = objects.filter((item) => item.status === 'uploaded').reduce((total, item) => total + item.bytes, 0);
  const reusedBytes = objects.filter((item) => item.status === 'hit_remote').reduce((total, item) => total + item.bytes, 0);
  const receipt = {
    schema: 'ai.delivery.prepare-receipt.v1',
    project: adapter.project,
    target,
    sourceSha,
    artifactIdentity: artifact.archive.sha256,
    releaseManifest: {
      object: releaseManifestObject,
      sha256: `sha256:${releaseManifestSha256}`,
      manifestDigest: releaseManifest.manifestDigest,
    },
    releaseIndex: {
      object: releaseIndexObject,
      sha256: `sha256:${releaseIndexSha256}`,
      indexDigest: releaseIndex.indexDigest,
    },
    provenance: { object: provenanceObject, sha256: `sha256:${provenanceSha256}`, provenanceDigest: provenance.provenanceDigest },
    seal: {
      key: requestedLifecycle.lifecycle.key,
      objectRoot: requestedLifecycle.lifecycle.paths.root,
      eligiblePhysicalNodes: lifecycles.map(({ lifecycle }) => lifecycle.key.physical_node),
      state: 'UPLOADED', reused: requestedLifecycle.uploaded.reused,
    },
    objects,
    cacheStatus: objects.every((item) => item.status === 'hit_remote') ? 'hit_remote' : objects.every((item) => item.status === 'uploaded') ? 'miss' : 'partial_hit',
    timings: {
      plan: plan.timings?.plan ?? 0,
      tests: build.timings?.tests ?? 0,
      typecheck: build.timings?.typecheck ?? 0,
      build: build.timings?.build ?? 0,
      materialize: build.timings?.materialize ?? 0,
      package: packageSet.timings?.package ?? 0,
      publication: publicationMs,
      total: elapsed(started),
    },
    traffic: { artifactBytes: archive.byteLength + runtimeManifestBody.byteLength + releaseManifestBody.byteLength + releaseIndexBody.byteLength, uploadedBytes, reusedBytes },
    completedAt: new Date().toISOString(),
  };
  if (options.output) {
    const output = resolve(options.output);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, prettyStableJson(receipt));
  }
  return receipt;
}

export async function resolvePreparedArtifact(adapter, options, dependencies = {}) {
  const started = performance.now();
  const sourceSha = exactSourceSha(options.sourceSha, 'OSS_SOURCE_SHA_INVALID');
  const target = exactTarget(adapter, options.target, 'OSS_TARGET');
  const node = required(options.node, 'OSS_NODE_REQUIRED');
  invariant(Boolean(adapter.nodes[node]?.deployments?.[target]), 'OSS_NODE_TARGET_MISMATCH', `Unknown deployment ${node}/${target}`);
  const client = dependencies.client ?? ossClientFromEnvironment(options.endpoint, dependencies);
  const root = `${objectRoot(adapter.project, target, sourceSha, options.prefix)}/`;
  let releaseIndexObject;
  let expectedRecipe;
  let releaseIndexBody;
  const candidates = options.allowLegacy === false
    ? [[CURRENT_RELEASE_INDEX, ARTIFACT_RECIPE]]
    : [[CURRENT_RELEASE_INDEX, ARTIFACT_RECIPE], [PREVIOUS_RELEASE_INDEX, 'r3-normalized-runtime-modes'], [LEGACY_RELEASE_INDEX, null]];
  for (const [name, recipe] of candidates) {
    try {
      releaseIndexObject = `${root}${name}`;
      releaseIndexBody = await client.getObject(releaseIndexObject, 'OSS_ARTIFACT_NOT_FOUND');
      expectedRecipe = recipe;
      break;
    } catch (error) {
      if (!(error instanceof DeliveryError) || error.code !== 'OSS_ARTIFACT_NOT_FOUND') throw error;
    }
  }
  invariant(releaseIndexBody, 'OSS_ARTIFACT_NOT_FOUND', 'Prepared artifact release index is missing');
  const releaseIndex = JSON.parse(releaseIndexBody.toString('utf8'));
  validateReleaseIndex(releaseIndex, { adapter, target, sourceSha, root, expectedRecipe });
  const releaseManifestObject = releaseIndex.releaseManifest.object;
  const releaseManifestBody = await client.getObject(releaseManifestObject);
  invariant(`sha256:${sha256(releaseManifestBody)}` === releaseIndex.releaseManifest.sha256, 'OSS_RELEASE_MANIFEST_HASH_MISMATCH', 'Release manifest content hash differs');
  const manifest = JSON.parse(releaseManifestBody.toString('utf8'));
  validateReleaseManifest(manifest, { adapter, target, sourceSha, node, root, expectedRecipe });
  invariant(manifest.manifestDigest === releaseIndex.releaseManifest.manifestDigest, 'OSS_RELEASE_INDEX_MANIFEST_MISMATCH', 'Release index semantic digest differs from the manifest');
  invariant(manifest.artifact.sha256 === releaseIndex.artifactIdentity, 'OSS_RELEASE_INDEX_ARTIFACT_MISMATCH', 'Release index artifact identity differs from the manifest');
  let provenance = null;
  if (expectedRecipe === ARTIFACT_RECIPE) {
    const provenanceBody = await client.getObject(manifest.provenance.object);
    invariant(`sha256:${sha256(provenanceBody)}` === manifest.provenance.sha256, 'OSS_PROVENANCE_HASH_MISMATCH', 'Build provenance content hash differs');
    provenance = JSON.parse(provenanceBody.toString('utf8'));
    validateBuildProvenance(provenance, { adapter, target, sourceSha, manifest });
  }

  const runtimeManifestBody = await client.getObject(manifest.runtimeManifest.object);
  invariant(digest(runtimeManifestBody) === manifest.runtimeManifest.sha256, 'OSS_RUNTIME_MANIFEST_HASH_MISMATCH', 'Runtime manifest content hash differs');
  const runtimeManifest = JSON.parse(runtimeManifestBody.toString('utf8'));
  validateRuntimeManifest(runtimeManifest, {
    project: adapter.project,
    target,
    sourceSha,
    artifact: {
      archive: manifest.artifact,
      treeDigest: manifest.artifact.treeDigest,
      manifestDigest: manifest.runtimeManifest.manifestDigest,
    },
    strictModes: true,
  });
  const archiveHead = await client.headObject(manifest.artifact.object);
  invariant(archiveHead.exists, 'OSS_ARTIFACT_NOT_FOUND', 'Prepared artifact archive is missing');
  invariant(archiveHead.bytes === manifest.artifact.bytes, 'OSS_ARTIFACT_BYTES_MISMATCH', 'Prepared artifact archive size differs');
  if (archiveHead.sha256) invariant(archiveHead.sha256 === manifest.artifact.sha256.slice(7), 'OSS_ARTIFACT_DIGEST_MISMATCH', 'Prepared artifact archive digest metadata differs');

  return {
    schema: 'ai.delivery.oss-resolution.v1',
    project: adapter.project,
    target,
    sourceSha,
    node,
    releaseIndexObject,
    releaseIndex,
    releaseManifestObject,
    manifest,
    provenance,
    runtimeManifest,
    timings: { artifactLookup: elapsed(started), total: elapsed(started) },
  };
}

// A historical failure can leave every immutable object in OSS while omitting
// the UPLOADED receipt for a later control-plane Seal.  Reuse the verified
// artifact and provenance; never recreate or overwrite the release index.
export async function recoverPreparedArtifact(adapter, options, dependencies = {}) {
  const sourceSha = exactSourceSha(options.sourceSha, 'RECOVER_SOURCE_SHA_INVALID');
  const target = exactTarget(adapter, options.target, 'RECOVER_TARGET');
  const node = required(options.node, 'RECOVER_NODE_REQUIRED');
  const controlSha = exactSourceSha(options.controlSha, 'RECOVER_CONTROL_SHA_INVALID');
  const requestId = required(options.requestId, 'RECOVER_REQUEST_ID_REQUIRED');
  const buildRunner = required(options.buildRunner, 'RECOVER_BUILD_RUNNER_REQUIRED');
  invariant(options.actorRole === 'build', 'RECOVER_ROLE_FORBIDDEN', 'Only the Build role may recover a Seal upload receipt');
  const client = dependencies.client ?? ossClientFromEnvironment(options.endpoint, dependencies);
  const resolved = await resolvePreparedArtifact(adapter, { ...options, sourceSha, target, node, allowLegacy: false }, { ...dependencies, client });
  const lifecycles = [];
  for (const physicalNode of eligibleNodes(adapter, target)) {
    const lifecycle = createSealLifecycleStore(client, {
      project: adapter.project, sourceSha, releaseTarget: target, physicalNode,
      artifactDigest: resolved.manifest.artifact.sha256, controlPlaneSha: controlSha,
    });
    const begun = await lifecycle.begin({ requestId, actorRole: 'build' });
    invariant(begun.action !== 'observe' && begun.action !== 'stop', 'SEAL_BUILD_IN_PROGRESS',
      'Another request owns the active Seal build lease', {
        sealKey: lifecycle.key.seal_key, ownerRequestId: begun.lease?.request_id, retryable: true,
      });
    const uploaded = await lifecycle.markUploaded({
      requestId, actorRole: 'build', buildRunner, routing: { recovered_existing_artifact: true },
      artifact: {
        object: resolved.manifest.artifact.object, digest: resolved.manifest.artifact.sha256,
        bytes: resolved.manifest.artifact.bytes, releaseManifestObject: resolved.releaseManifestObject,
      },
      provenance: { object: resolved.manifest.provenance.object, digest: resolved.manifest.provenance.sha256 },
      reused: true,
    });
    lifecycles.push({ lifecycle, uploaded });
  }
  const requestedLifecycle = lifecycles.find(({ lifecycle }) => lifecycle.key.physical_node === node);
  invariant(requestedLifecycle, 'RECOVER_PHYSICAL_NODE_INVALID', 'Recovery node is not a physical artifact placement');
  return {
    schema: 'ai.delivery.prepare-recovery-receipt.v1', project: adapter.project, target, sourceSha,
    artifactIdentity: resolved.manifest.artifact.sha256, cacheStatus: 'hit_remote', recovered: true,
    releaseManifest: { object: resolved.releaseManifestObject, sha256: resolved.releaseIndex.releaseManifest.sha256 },
    provenance: { object: resolved.manifest.provenance.object, sha256: resolved.manifest.provenance.sha256 },
    seal: { key: requestedLifecycle.lifecycle.key, state: await requestedLifecycle.lifecycle.read(), uploaded: requestedLifecycle.uploaded.receipt },
    recoveredNodes: lifecycles.map(({ lifecycle }) => lifecycle.key.physical_node),
    completedAt: new Date().toISOString(),
  };
}

export async function finalizePreparedSeal(adapter, options, dependencies = {}) {
  const sourceSha = exactSourceSha(options.sourceSha, 'SEAL_SOURCE_SHA_INVALID');
  const target = exactTarget(adapter, options.target, 'SEAL_TARGET');
  const node = required(options.node, 'SEAL_NODE_REQUIRED');
  const artifactDigest = required(options.artifactDigest, 'SEAL_ARTIFACT_DIGEST_REQUIRED');
  const controlPlaneSha = exactSourceSha(options.controlPlaneSha, 'SEAL_CONTROL_SHA_INVALID');
  const client = dependencies.client ?? ossClientFromEnvironment(options.endpoint, dependencies);
  const lifecycle = createSealLifecycleStore(client, { project: adapter.project, sourceSha, releaseTarget: target, physicalNode: node, artifactDigest, controlPlaneSha });
  const current = await lifecycle.read();
  invariant(current.status === 'UPLOADED' || current.status === 'VALIDATED' || current.status === 'SEALED',
    'SEAL_UPLOAD_RECEIPT_MISSING', 'Candidate cannot be sealed without authoritative UPLOADED evidence');
  if (current.status === 'SEALED') return { lifecycle, state: current, reused: true };
  if (current.status === 'UPLOADED') {
    await lifecycle.markValidated({
      requestId: options.requestId, actorRole: options.actorRole, releaseRunner: options.releaseRunner, reused: options.reused === true,
      validation: { ok: true, receipt_digest: digest(options.validationReceipt), receipt: options.validationReceipt },
    });
  }
  const sealed = await lifecycle.seal({ requestId: options.requestId, actorRole: options.actorRole });
  return { lifecycle, state: await lifecycle.read(), reused: sealed.reused };
}

export async function requireFinalSealReceipt(adapter, options, dependencies = {}) {
  const client = dependencies.client ?? ossClientFromEnvironment(options.endpoint, dependencies);
  const lifecycle = createSealLifecycleStore(client, {
    project: adapter.project, sourceSha: options.sourceSha, releaseTarget: options.target, physicalNode: options.node,
    artifactDigest: options.artifactDigest, controlPlaneSha: options.controlPlaneSha,
  });
  const state = await lifecycle.readExactFinal();
  const recovery = classifySealCheckpoint({ exactResource: lifecycle.paths.final, finalSeal: state.status === 'SEALED',
    uploaded: Boolean(state.uploaded), validated: Boolean(state.validated), safeCheckpoint: state.status });
  invariant(state.status === 'SEALED', 'FINAL_SEAL_RECEIPT_MISSING', 'OSS final Seal receipt is missing; Action success is not Seal authority', {
    status: state.status, sealKey: lifecycle.key.seal_key, finalSealReceiptObject: lifecycle.paths.final, ...recovery,
  });
  return { key: lifecycle.key, object: lifecycle.paths.final, receipt: state.final, reused: true };
}

export async function resolveExactFinalSealReceipt(adapter, options, dependencies = {}) {
  const client = dependencies.client ?? ossClientFromEnvironment(options.endpoint, dependencies);
  const prepared = await resolvePreparedArtifact(adapter, { ...options, allowLegacy: false }, { ...dependencies, client });
  invariant(prepared.provenance?.controlPlaneSha, 'OSS_PROVENANCE_CONTROL_SHA_MISSING', 'Build provenance does not identify the control plane');
  const exact = await findFinalSealReceipt(adapter, {
    ...options, artifactDigest: prepared.manifest.artifact.sha256,
  }, { ...dependencies, client });
  if (exact) return exact;
  return requireFinalSealReceipt(adapter, { ...options, artifactDigest: prepared.manifest.artifact.sha256,
    controlPlaneSha: prepared.provenance.controlPlaneSha }, { ...dependencies, client });
}

export async function findFinalSealReceipt(adapter, options, dependencies = {}) {
  const sourceSha = exactSourceSha(options.sourceSha, 'SEAL_SOURCE_SHA_INVALID');
  const target = exactTarget(adapter, options.target, 'SEAL_TARGET');
  const node = required(options.node, 'SEAL_NODE_REQUIRED');
  const client = dependencies.client ?? ossClientFromEnvironment(options.endpoint, dependencies);
  const prefix = `${objectRoot(adapter.project, target, sourceSha, options.prefix)}/seals/v1/${node}/`;
  const objects = (await client.listPrefix(prefix)).filter((object) => object.endsWith('/final-seal.json'));
  const receipts = [];
  for (const object of objects) {
    const candidate = JSON.parse((await client.getObject(object)).toString('utf8'));
    const key = createSealKey({
      sourceSha: candidate.key?.source_sha, releaseTarget: candidate.key?.release_target, physicalNode: candidate.key?.physical_node,
      artifactDigest: candidate.key?.artifact_digest, controlPlaneSha: candidate.key?.control_plane_sha,
    });
    if (options.artifactDigest && key.artifact_digest !== options.artifactDigest) continue;
    const paths = sealObjectPaths(adapter.project, key, options.prefix);
    invariant(paths.final === object, 'FINAL_SEAL_OBJECT_PATH_MISMATCH', 'Final Seal receipt is outside its canonical path');
    const state = await createSealLifecycleStore(client, { project: adapter.project, sourceSha, releaseTarget: target, physicalNode: node,
      artifactDigest: key.artifact_digest, controlPlaneSha: key.control_plane_sha, prefix: options.prefix }).read();
    if (state.status === 'SEALED') receipts.push({ key, object, receipt: state.final });
  }
  receipts.sort((left, right) => Date.parse(right.receipt.updated_at) - Date.parse(left.receipt.updated_at));
  return receipts[0] ?? null;
}

export async function findSealLifecycleState(adapter, options, dependencies = {}) {
  const sourceSha = exactSourceSha(options.sourceSha, 'SEAL_SOURCE_SHA_INVALID');
  const target = exactTarget(adapter, options.target, 'SEAL_TARGET');
  const node = required(options.node, 'SEAL_NODE_REQUIRED');
  const client = dependencies.client ?? ossClientFromEnvironment(options.endpoint, dependencies);
  const prefix = `${objectRoot(adapter.project, target, sourceSha, options.prefix)}/seals/v1/${node}/`;
  const identities = (await client.listPrefix(prefix)).filter((object) => object.endsWith('/seal-key.json'));
  const states = [];
  for (const object of identities) {
    const identity = JSON.parse((await client.getObject(object)).toString('utf8'));
    const key = createSealKey({
      sourceSha: identity.source_sha, releaseTarget: identity.release_target, physicalNode: identity.physical_node,
      artifactDigest: identity.artifact_digest, controlPlaneSha: identity.control_plane_sha,
    });
    const lifecycle = createSealLifecycleStore(client, { project: adapter.project, sourceSha, releaseTarget: target, physicalNode: node,
      artifactDigest: key.artifact_digest, controlPlaneSha: key.control_plane_sha, prefix: options.prefix });
    invariant(lifecycle.paths.identity === object && identity.seal_key === key.seal_key,
      'SEAL_KEY_OBJECT_PATH_MISMATCH', 'Seal lifecycle identity is outside its canonical path');
    states.push({ key, paths: lifecycle.paths, state: await lifecycle.read() });
  }
  states.sort((left, right) => Date.parse(right.state.updated_at ?? 0) - Date.parse(left.state.updated_at ?? 0));
  return states[0] ?? { key: null, paths: null, state: { schema: 'ai.delivery.seal-state.v1', status: 'ABSENT', updated_at: null, retryable: true } };
}

export async function inspectPreparedArtifact(adapter, options, dependencies = {}) {
  try {
    const resolved = await resolvePreparedArtifact(adapter, { ...options, allowLegacy: false }, dependencies);
    return {
      schema: 'ai.delivery.prepared-inspection.v1', project: adapter.project,
      target: resolved.manifest.target, sourceSha: resolved.manifest.sourceSha,
      node: options.node, exists: true,
      artifactIdentity: resolved.manifest.artifact.sha256,
      releaseManifestObject: resolved.releaseManifestObject,
      timings: resolved.timings, completedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof DeliveryError && error.code === 'OSS_ARTIFACT_NOT_FOUND') {
      return {
        schema: 'ai.delivery.prepared-inspection.v1', project: adapter.project,
        target: exactTarget(adapter, options.target, 'OSS_TARGET'),
        sourceSha: exactSourceSha(options.sourceSha, 'OSS_SOURCE_SHA_INVALID'),
        node: required(options.node, 'OSS_NODE_REQUIRED'), exists: false,
        completedAt: new Date().toISOString(),
      };
    }
    throw error;
  }
}

export async function publishWorkflowEvidence(adapter, options, dependencies = {}) {
  const started = performance.now();
  const sourceSha = exactSourceSha(options.sourceSha, 'EVIDENCE_SOURCE_SHA_INVALID');
  const target = exactTarget(adapter, options.target, 'EVIDENCE_TARGET');
  const kind = required(options.kind, 'EVIDENCE_KIND_REQUIRED');
  invariant(['prepare', 'deploy'].includes(kind), 'EVIDENCE_KIND_INVALID', 'Workflow evidence kind must be prepare or deploy');
  const runId = required(options.githubRunId, 'EVIDENCE_RUN_ID_REQUIRED');
  const runAttempt = required(options.githubRunAttempt, 'EVIDENCE_RUN_ATTEMPT_REQUIRED');
  invariant(/^\d+$/.test(runId) && /^\d+$/.test(runAttempt), 'EVIDENCE_RUN_ID_INVALID', 'Workflow run identity must be numeric');
  const body = await readFile(resolve(required(options.file, 'EVIDENCE_FILE_REQUIRED')));
  invariant(body.byteLength > 0 && body.byteLength <= 10 * 1024 * 1024, 'EVIDENCE_SIZE_INVALID', 'Workflow evidence must be between 1 byte and 10 MiB');
  const bodySha256 = sha256(body);
  const object = `${objectRoot(adapter.project, target, sourceSha, options.prefix)}/workflow-evidence/${kind}/${runId}-${runAttempt}-${bodySha256}.json`;
  const client = dependencies.client ?? ossClientFromEnvironment(options.endpoint, dependencies);
  const publication = await client.putImmutable(object, body, 'application/json');
  const receipt = {
    schema: 'ai.delivery.workflow-evidence-receipt.v1', project: adapter.project,
    target, sourceSha, kind, github: { runId, runAttempt },
    evidence: { object, sha256: `sha256:${bodySha256}`, bytes: body.byteLength, status: publication.status },
    timings: { publication: elapsed(started), total: elapsed(started) },
    completedAt: new Date().toISOString(),
  };
  if (options.output) {
    const output = resolve(options.output);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, prettyStableJson(receipt));
  }
  return receipt;
}

export function ossClientFromEnvironment(endpoint, dependencies = {}) {
  const environment = dependencies.environment ?? process.env;
  const credentials = resolveStaticAccessKeyCredentials({
    mode: dependencies.authMode ?? environment.AI_DELIVERY_AUTH_MODE,
    roleKind: dependencies.roleKind ?? environment.AI_DELIVERY_ROLE_KIND,
    allowStatic: dependencies.allowStatic ?? environment.AI_DELIVERY_ALLOW_STATIC_ACCESS_KEY === 'true',
    accessKeyId: environment.ALIYUN_OSS_ACCESS_KEY_ID,
    accessKeySecret: environment.ALIYUN_OSS_ACCESS_KEY_SECRET,
    securityToken: environment.ALIYUN_OSS_SECURITY_TOKEN || null,
  }, { warning: dependencies.warning ?? ((message) => process.stderr.write(`${message}\n`)) });
  return createOssClient(
    {
      accessKeyId: credentials.accessKeyId,
      accessKeySecret: credentials.accessKeySecret,
      securityToken: credentials.securityToken,
      bucket: required(environment.ALIYUN_OSS_BUCKET, 'ALIYUN_OSS_BUCKET_REQUIRED'),
      endpoint: endpoint ?? required(environment.ALIYUN_OSS_ENDPOINT, 'ALIYUN_OSS_ENDPOINT_REQUIRED'),
    },
    dependencies
  );
}

export function resolveDownloadEndpoint(publicEndpoint, override) {
  if (override) return normalizeEndpoint(override);
  return normalizeEndpoint(publicEndpoint);
}

export function createOssClient(configuration, dependencies = {}) {
  const auth = {
    accessKeyId: required(configuration.accessKeyId, 'OSS_ACCESS_KEY_ID_REQUIRED'),
    accessKeySecret: required(configuration.accessKeySecret, 'OSS_ACCESS_KEY_SECRET_REQUIRED'),
    securityToken: configuration.securityToken || null,
    bucket: required(configuration.bucket, 'OSS_BUCKET_REQUIRED'),
    endpoint: normalizeEndpoint(configuration.endpoint),
  };
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? (() => new Date());
  const monotonicNow = dependencies.monotonicNow ?? (() => performance.now());
  let authoritativeTimestamp = null;
  let authoritativeObservedAt = null;
  if (dependencies.now !== undefined) {
    authoritativeTimestamp = now().getTime();
    authoritativeObservedAt = monotonicNow();
  }

  return Object.freeze({
    endpoint: auth.endpoint,
    authoritativeNow() {
      invariant(authoritativeTimestamp !== null && authoritativeObservedAt !== null, 'OSS_AUTHORITATIVE_TIME_UNAVAILABLE',
        'A trusted OSS response time is required before evaluating a distributed lease');
      return new Date(authoritativeTimestamp + Math.max(0, monotonicNow() - authoritativeObservedAt));
    },
    async headObject(object) {
      const response = await request('HEAD', object);
      if (response.status === 404) return { exists: false, object };
      await assertResponse(response, 'OSS_HEAD_FAILED');
      return {
        exists: true,
        object,
        bytes: Number(response.headers.get('content-length') ?? '0'),
        sha256: response.headers.get('x-oss-meta-sha256'),
      };
    },
    async getObject(object, missingCode = 'OSS_OBJECT_NOT_FOUND') {
      const response = await request('GET', object);
      await assertResponse(response, response.status === 404 ? missingCode : 'OSS_GET_FAILED');
      return Buffer.from(await response.arrayBuffer());
    },
    async listPrefix(prefix) {
      const response = await request('GET', null, {
        query: { 'list-type': '2', prefix, 'max-keys': '1000', 'encoding-type': 'url' },
      });
      await assertResponse(response, 'OSS_LIST_FAILED');
      const xml = await response.text();
      invariant(!/<IsTruncated>true<\/IsTruncated>/.test(xml), 'OSS_LIST_TRUNCATED', 'Prepared artifact prefix contains too many objects');
      return [...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((match) => decodeURIComponent(decodeXml(match[1]))).sort();
    },
    async putImmutable(object, body, contentType = 'application/octet-stream', putOptions = {}) {
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
      const contentSha256 = sha256(bytes);
      const contentMd5 = createHash('md5').update(bytes).digest('base64');
      const requestOptions = { body: bytes, contentMd5, contentType, ossHeaders: {
        'x-oss-forbid-overwrite': 'true', 'x-oss-meta-sha256': contentSha256,
      }, ...(putOptions.verifyAfterUncertain ? { maxAttempts: 1 } : {}) };
      let response;
      try { response = await request('PUT', object, requestOptions); }
      catch (error) {
        if (!putOptions.verifyAfterUncertain || !(error?.details?.retryable || isTransientNetworkFailure(error))) throw error;
        const existing = await this.headObject(object);
        if (existing.exists) return { ...(await verifyExisting(this, existing, object, bytes, contentSha256)), readbackRecovered: true };
        response = await request('PUT', object, { ...requestOptions, maxAttempts: Number(dependencies.networkMaxAttempts ?? 3) });
      }
      if (response.status === 409) {
        const existing = await this.headObject(object);
        return verifyExisting(this, existing, object, bytes, contentSha256);
      }
      await assertResponse(response, 'OSS_IMMUTABLE_PUT_FAILED');
      return { object, status: 'uploaded', bytes: bytes.byteLength, sha256: `sha256:${contentSha256}` };
    },
    signGet(object, ttlSeconds = 900) {
      invariant(Number.isInteger(ttlSeconds) && ttlSeconds >= 60 && ttlSeconds <= 3600, 'OSS_SIGNED_URL_TTL_INVALID', 'OSS signed URL TTL must be between 60 and 3600 seconds');
      const expires = Math.floor(now().getTime() / 1000) + ttlSeconds;
      const tokenQuery = auth.securityToken ? `?security-token=${auth.securityToken}` : '';
      const canonicalResource = `/${auth.bucket}/${object}${tokenQuery}`;
      const value = `GET\n\n\n${expires}\n${canonicalResource}`;
      const url = objectUrl(auth, object);
      url.searchParams.set('OSSAccessKeyId', auth.accessKeyId);
      url.searchParams.set('Expires', String(expires));
      if (auth.securityToken) url.searchParams.set('security-token', auth.securityToken);
      url.searchParams.set('Signature', signature(auth.accessKeySecret, value));
      return url.toString();
    },
  });

  async function request(method, object, options = {}) {
    const date = now().toUTCString();
    const url = object === null ? bucketUrl(auth) : objectUrl(auth, object);
    for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
    const ossHeaders = {
      ...(auth.securityToken ? { 'x-oss-security-token': auth.securityToken } : {}),
      ...(options.ossHeaders ?? {}),
    };
    const headers = {
      Date: date,
      ...ossHeaders,
    };
    if (options.contentMd5) headers['Content-MD5'] = options.contentMd5;
    if (options.contentType) headers['Content-Type'] = options.contentType;
    if (options.body) headers['Content-Length'] = String(options.body.byteLength);
    const canonicalOssHeaders = Object.entries(ossHeaders)
      .map(([key, value]) => [key.toLowerCase(), String(value).trim()])
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}:${value}\n`)
      .join('');
    const canonicalResource = object === null ? `/${auth.bucket}/` : `/${auth.bucket}/${object}`;
    const value = `${method}\n${options.contentMd5 ?? ''}\n${options.contentType ?? ''}\n${date}\n${canonicalOssHeaders}${canonicalResource}`;
    headers.Authorization = `OSS ${auth.accessKeyId}:${signature(auth.accessKeySecret, value)}`;
    const retried = await withFiniteRetry(async () => {
      const response = await fetchImpl(url, { method, headers, body: options.body });
      if (response.status === 408 || response.status === 429 || (response.status >= 500 && response.status <= 504)) {
        const error = new Error(`OSS returned transient HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      const serverDate = Date.parse(response.headers.get('date') ?? '');
      if (Number.isFinite(serverDate)) {
        authoritativeTimestamp = serverDate;
        authoritativeObservedAt = monotonicNow();
      }
      return response;
    }, {
      stage: `oss-${method.toLowerCase()}`,
      maxAttempts: Number(options.maxAttempts ?? dependencies.networkMaxAttempts ?? 3),
      delaysMs: dependencies.networkRetryDelaysMs ?? [250, 1000, 3000],
      sleep: dependencies.sleep,
    });
    return retried.value;
  }
}

async function verifyExisting(client, existing, object, expectedBody, expectedSha256) {
  invariant(existing.exists, 'OSS_IMMUTABLE_RACE_LOST', 'Immutable object appeared but cannot be read', { object });
  invariant(existing.bytes === expectedBody.byteLength, 'OSS_IMMUTABLE_OBJECT_CONFLICT', 'Existing immutable object size differs', { object });
  if (existing.sha256 === expectedSha256) {
    return { object, status: 'hit_remote', bytes: expectedBody.byteLength, sha256: `sha256:${expectedSha256}` };
  }
  const actual = await client.getObject(object);
  invariant(sha256(actual) === expectedSha256, 'OSS_IMMUTABLE_OBJECT_CONFLICT', 'Existing immutable object content differs', { object });
  return { object, status: 'hit_remote', bytes: expectedBody.byteLength, sha256: `sha256:${expectedSha256}` };
}

function validateReleaseIndex(index, { adapter, target, sourceSha, root, expectedRecipe }) {
  invariant(index.schema === 'ai.delivery.oss-release-index.v1' && index.protocolVersion === 1, 'OSS_RELEASE_INDEX_SCHEMA_INVALID', 'Release index schema is unsupported');
  invariant(index.project === adapter.project, 'OSS_RELEASE_INDEX_PROJECT_MISMATCH', 'Release index project differs');
  invariant(index.target === target, 'OSS_RELEASE_INDEX_TARGET_MISMATCH', 'Release index target differs');
  invariant(index.sourceSha === sourceSha, 'OSS_RELEASE_INDEX_SOURCE_SHA_MISMATCH', 'Release index source SHA differs');
  if (expectedRecipe !== null) invariant(index.artifactRecipe === expectedRecipe, 'OSS_ARTIFACT_RECIPE_MISMATCH', 'Release index artifact recipe differs');
  invariant(/^sha256:[a-f0-9]{64}$/.test(index.artifactIdentity), 'OSS_RELEASE_INDEX_ARTIFACT_INVALID', 'Release index artifact identity is invalid');
  invariant(
    typeof index.releaseManifest?.object === 'string' && new RegExp(`^${escapeRegExp(root)}[a-f0-9]{64}/release-manifest-[a-f0-9]{64}\\.json$`).test(index.releaseManifest.object),
    'OSS_RELEASE_INDEX_OBJECT_INVALID',
    'Release index manifest object is outside its content-addressed source prefix'
  );
  invariant(/^sha256:[a-f0-9]{64}$/.test(index.releaseManifest?.sha256), 'OSS_RELEASE_INDEX_HASH_INVALID', 'Release index manifest hash is invalid');
  invariant(/^sha256:[a-f0-9]{64}$/.test(index.releaseManifest?.manifestDigest), 'OSS_RELEASE_INDEX_DIGEST_INVALID', 'Release index manifest semantic digest is invalid');
  const objectHash = index.releaseManifest.object.match(/release-manifest-([a-f0-9]{64})\.json$/)?.[1];
  invariant(index.releaseManifest.sha256 === `sha256:${objectHash}`, 'OSS_RELEASE_INDEX_HASH_MISMATCH', 'Release index manifest path and hash differ');
  const claimed = index.indexDigest;
  const unsigned = { ...index };
  delete unsigned.indexDigest;
  invariant(claimed === digest(unsigned), 'OSS_RELEASE_INDEX_DIGEST_MISMATCH', 'Release index semantic digest differs');
}

function validateReleaseManifest(manifest, { adapter, target, sourceSha, node, root, expectedRecipe }) {
  invariant(manifest.schema === 'ai.delivery.oss-release.v1' && manifest.protocolVersion === 1, 'OSS_RELEASE_MANIFEST_SCHEMA_INVALID', 'Release manifest schema is unsupported');
  invariant(manifest.project === adapter.project, 'OSS_ARTIFACT_PROJECT_MISMATCH', 'Release manifest project differs');
  invariant(manifest.target === target, 'OSS_ARTIFACT_TARGET_MISMATCH', 'Release manifest target differs');
  invariant(manifest.sourceSha === sourceSha, 'OSS_ARTIFACT_SOURCE_SHA_MISMATCH', 'Release manifest source SHA differs');
  if (expectedRecipe !== null) invariant(manifest.buildEnvironment?.artifactRecipe === expectedRecipe, 'OSS_ARTIFACT_RECIPE_MISMATCH', 'Release manifest artifact recipe differs');
  invariant(Array.isArray(manifest.eligibleNodes) && manifest.eligibleNodes.includes(node), 'OSS_ARTIFACT_NODE_MISMATCH', 'Release manifest does not support the requested node');
  for (const object of [manifest.artifact?.object, manifest.runtimeManifest?.object]) {
    invariant(typeof object === 'string' && object.startsWith(root), 'OSS_ARTIFACT_OBJECT_SCOPE_INVALID', 'Release object is outside its immutable prefix');
  }
  if (expectedRecipe === ARTIFACT_RECIPE) {
    invariant(typeof manifest.provenance?.object === 'string' && manifest.provenance.object.startsWith(root),
      'OSS_PROVENANCE_OBJECT_SCOPE_INVALID', 'Build provenance is outside its immutable prefix');
    invariant(/^sha256:[a-f0-9]{64}$/.test(manifest.provenance?.sha256), 'OSS_PROVENANCE_DIGEST_INVALID', 'Build provenance digest is invalid');
  }
  invariant(/^sha256:[a-f0-9]{64}$/.test(manifest.artifact?.sha256), 'OSS_ARTIFACT_DIGEST_INVALID', 'Release artifact digest is invalid');
  invariant(/^sha256:[a-f0-9]{64}$/.test(manifest.artifact?.treeDigest), 'OSS_TREE_DIGEST_INVALID', 'Release tree digest is invalid');
  invariant(/^sha256:[a-f0-9]{64}$/.test(manifest.runtimeManifest?.sha256), 'OSS_RUNTIME_MANIFEST_DIGEST_INVALID', 'Runtime manifest digest is invalid');
  const claimed = manifest.manifestDigest;
  const unsigned = { ...manifest };
  delete unsigned.manifestDigest;
  invariant(claimed === digest(unsigned), 'OSS_RELEASE_MANIFEST_DIGEST_MISMATCH', 'Release manifest semantic digest differs');
}

function validateBuildProvenance(provenance, { adapter, target, sourceSha, manifest }) {
  invariant(provenance.schema === 'ai.delivery.build-provenance.v1' && provenance.protocolVersion === 1,
    'OSS_PROVENANCE_SCHEMA_INVALID', 'Build provenance schema is unsupported');
  invariant(provenance.project === adapter.project && provenance.target === target && provenance.sourceSha === sourceSha,
    'OSS_PROVENANCE_SCOPE_MISMATCH', 'Build provenance scope differs');
  invariant(provenance.artifact?.sha256 === manifest.artifact.sha256 && provenance.artifact?.object === manifest.artifact.object,
    'OSS_PROVENANCE_ARTIFACT_MISMATCH', 'Build provenance artifact differs');
  invariant(provenance.runtimeManifest?.object === manifest.runtimeManifest.object
    && provenance.runtimeManifest?.manifestDigest === manifest.runtimeManifest.manifestDigest,
  'OSS_PROVENANCE_RUNTIME_MISMATCH', 'Build provenance runtime manifest differs');
  const claimed = provenance.provenanceDigest;
  const unsigned = { ...provenance };
  delete unsigned.provenanceDigest;
  invariant(claimed === digest(unsigned) && claimed === manifest.provenance.provenanceDigest,
    'OSS_PROVENANCE_SEMANTIC_MISMATCH', 'Build provenance semantic digest differs');
}

function validateRuntimeManifest(manifest, { project, target, sourceSha, artifact, strictModes = true }) {
  invariant(manifest.schema === 'ai.delivery.artifact.v1' && manifest.engineVersion === 2, 'OSS_RUNTIME_MANIFEST_SCHEMA_INVALID', 'Runtime manifest schema is unsupported');
  invariant(manifest.project === project, 'OSS_RUNTIME_PROJECT_MISMATCH', 'Runtime manifest project differs');
  invariant(manifest.target === target, 'OSS_RUNTIME_TARGET_MISMATCH', 'Runtime manifest target differs');
  invariant(manifest.sourceSha === sourceSha, 'OSS_RUNTIME_SOURCE_SHA_MISMATCH', 'Runtime manifest source SHA differs');
  invariant(manifest.archive?.sha256 === artifact.archive.sha256, 'OSS_RUNTIME_ARCHIVE_MISMATCH', 'Runtime manifest archive digest differs');
  invariant(manifest.treeDigest === artifact.treeDigest, 'OSS_RUNTIME_TREE_MISMATCH', 'Runtime manifest tree digest differs');
  invariant(manifest.manifestDigest === artifact.manifestDigest, 'OSS_RUNTIME_MANIFEST_MISMATCH', 'Runtime manifest semantic digest differs');
  invariant(Array.isArray(manifest.entries), 'OSS_RUNTIME_ENTRIES_INVALID', 'Runtime manifest entries are invalid');
  if (strictModes) {
    for (const entry of manifest.entries) {
      if (entry.type === 'directory') invariant(entry.mode === 0o755, 'OSS_RUNTIME_MODE_INVALID', 'Runtime directories must use mode 0755', { path: entry.path, mode: entry.mode });
      if (entry.type === 'file') invariant(entry.mode === 0o644 || entry.mode === 0o755, 'OSS_RUNTIME_MODE_INVALID', 'Runtime files must use mode 0644 or 0755', { path: entry.path, mode: entry.mode });
    }
  }
  const claimed = manifest.manifestDigest;
  const unsigned = { ...manifest };
  delete unsigned.manifestDigest;
  invariant(claimed === digest(unsigned), 'OSS_RUNTIME_MANIFEST_DIGEST_MISMATCH', 'Runtime manifest semantic digest differs');
}

function normalizedValidations(phases = {}) {
  return Object.fromEntries(['preflight', 'tests', 'typecheck', 'build'].map((phase) => [phase, (phases?.[phase] ?? []).map((item) => ({ name: item.name, argv: item.argv, exitCode: item.exitCode }))]));
}

async function normalizedRuntimeVerification(path, target) {
  if (!path) {
    invariant(target !== 'storefront', 'PREPARE_RUNTIME_EVIDENCE_REQUIRED', 'Storefront publication requires Linux x64 runtime evidence');
    return { status: 'not-required' };
  }
  const evidence = JSON.parse(await readFile(resolve(path), 'utf8'));
  invariant(evidence.ok === true, 'PREPARE_RUNTIME_VERIFICATION_FAILED', 'Runtime verification did not pass');
  if (target === 'storefront') {
    invariant(evidence.platform === 'linux' && evidence.arch === 'x64' && evidence.node === STOREFRONT_RUNTIME_NODE, 'PREPARE_RUNTIME_PLATFORM_INVALID', `Storefront runtime evidence must be linux/x64/${STOREFRONT_RUNTIME_NODE}`);
    invariant(evidence.nodeModulesPresent === false, 'PREPARE_RUNTIME_NODE_MODULES_INVALID', 'Storefront runtime artifact must not contain node_modules');
    for (const route of ['home', 'h5', 'dynamic']) {
      const result = evidence.routes?.[route];
      invariant(
        result?.status === 200 && /^text\/html(?:;|$)/.test(result.contentType ?? '') && Number.isSafeInteger(result.bytes) && result.bytes > 0,
        'PREPARE_RUNTIME_ROUTES_INCOMPLETE',
        `Storefront runtime route evidence is incomplete: ${route}`
      );
    }
    const asset = evidence.staticAsset;
    invariant(
      typeof asset?.name === 'string' &&
        /-[A-Za-z0-9_-]{8,}\.(?:css|js|mjs)$/.test(asset.name) &&
        asset.miss?.status === 200 &&
        Number.isSafeInteger(asset.miss?.bytes) &&
        asset.miss.bytes > 0 &&
        asset.hit?.status === 304 &&
        asset.hit?.bytes === 0 &&
        /(?:^|,)\s*immutable(?:,|$)/i.test(asset.cacheControl ?? '') &&
        typeof asset.etag === 'string' &&
        asset.etag.length > 0,
      'PREPARE_RUNTIME_STATIC_ASSET_INCOMPLETE',
      'Storefront hashed static asset evidence is incomplete'
    );
  }
  return {
    status: 'passed',
    platform: evidence.platform,
    arch: evidence.arch,
    node: evidence.node,
    routes: evidence.routes,
    staticAsset: evidence.staticAsset ? { name: evidence.staticAsset.name, miss: evidence.staticAsset.miss, hit: evidence.staticAsset.hit, cacheControl: evidence.staticAsset.cacheControl, etag: evidence.staticAsset.etag } : null,
    nodeModulesPresent: evidence.nodeModulesPresent,
  };
}

function eligibleNodes(adapter, target) {
  return Object.entries(adapter.nodes)
    .filter(([nodeId, node]) => Boolean(node.deployments?.[target])
      && (node.deployments[target].hostedBy === undefined || node.deployments[target].hostedBy === nodeId))
    .map(([node]) => node)
    .sort();
}

function exactTarget(adapter, target, prefix) {
  const value = required(target, `${prefix}_REQUIRED`);
  invariant(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value), `${prefix}_INVALID`, 'Target identifier is invalid');
  invariant(Boolean(adapter.targets[value]), `${prefix}_UNKNOWN`, `Unknown target ${value}`);
  return value;
}

function exactSourceSha(value, code) {
  invariant(SOURCE_SHA_PATTERN.test(value ?? ''), code, 'Source SHA must be one full lowercase Git commit SHA');
  return value;
}

function objectPrefix(project, target, sourceSha, archiveSha256, prefix) {
  invariant(SHA256_PATTERN.test(archiveSha256), 'OSS_ARCHIVE_DIGEST_INVALID', 'Archive digest is invalid');
  return `${objectRoot(project, target, sourceSha, prefix)}/${archiveSha256}`;
}

function objectRoot(project, target, sourceSha, prefix) {
  return [normalizePrefix(prefix), project, target, sourceSha].filter(Boolean).join('/');
}

function normalizePrefix(prefix = DEFAULT_PREFIX) {
  const value = String(prefix ?? DEFAULT_PREFIX).replace(/^\/+|\/+$/g, '');
  invariant(!value.split('/').includes('..'), 'OSS_PREFIX_INVALID', 'OSS object prefix is invalid');
  return value;
}

function normalizeEndpoint(value) {
  return required(value, 'OSS_ENDPOINT_REQUIRED')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

function objectUrl(auth, object) {
  const encoded = object.split('/').map(encodeURIComponent).join('/');
  return new URL(`https://${auth.bucket}.${auth.endpoint}/${encoded}`);
}

function bucketUrl(auth) {
  return new URL(`https://${auth.bucket}.${auth.endpoint}/`);
}

function signature(secret, value) {
  return createHmac('sha1', secret).update(value).digest('base64');
}

async function assertResponse(response, code) {
  if (response.ok) return;
  const detail = (await response.text()).slice(0, 600);
  throw new DeliveryError(code, `${code}: HTTP ${response.status}`, { status: response.status, detail });
}

function decodeXml(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function required(value, code) {
  if (value === undefined || value === null || value === '') throw new DeliveryError(code, code.replaceAll('_', ' ').toLowerCase());
  return value;
}

function positiveInteger(value, code) {
  const number = Number(value);
  invariant(Number.isSafeInteger(number) && number > 0, code, 'Expected a positive integer');
  return number;
}

function nonnegativeInteger(value, code) {
  const number = Number(value);
  invariant(Number.isSafeInteger(number) && number >= 0, code, 'Expected a non-negative integer');
  return number;
}

function exactTimestamp(value, code) {
  invariant(typeof value === 'string' && Number.isFinite(Date.parse(value)), code, 'Expected an ISO timestamp');
  return new Date(value).toISOString();
}

function elapsed(started) {
  return Math.max(0, Math.round(performance.now() - started));
}
