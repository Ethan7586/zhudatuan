import { DeliveryError, invariant } from './errors.mjs';
import { digest, prettyStableJson, sha256 } from './stable.mjs';

export const SEAL_KEY_SCHEMA = 'ai.delivery.seal-key.v1';
export const SEAL_STATE_SCHEMA = 'ai.delivery.seal-state.v1';
export const FINAL_SEAL_SCHEMA = 'ai.delivery.final-seal.v1';
export const SEAL_STATES = Object.freeze(['ABSENT', 'BUILDING', 'UPLOADED', 'VALIDATED', 'SEALED', 'FAILED']);

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const REQUEST_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

export function createSealKey(input) {
  const sourceSha = exact(input.sourceSha, SHA_PATTERN, 'SEAL_SOURCE_SHA_INVALID');
  const releaseTarget = exact(input.releaseTarget, NAME_PATTERN, 'SEAL_TARGET_INVALID');
  const physicalNode = exact(input.physicalNode, NAME_PATTERN, 'SEAL_NODE_INVALID');
  const artifactDigest = exact(input.artifactDigest, DIGEST_PATTERN, 'SEAL_ARTIFACT_DIGEST_INVALID');
  const controlPlaneSha = exact(input.controlPlaneSha, SHA_PATTERN, 'SEAL_CONTROL_SHA_INVALID');
  const serialization = [
    'zdt-seal-key/v1',
    `source_sha=${sourceSha}`,
    `release_target=${releaseTarget}`,
    `physical_node=${physicalNode}`,
    `artifact_digest=${artifactDigest}`,
    `control_plane_sha=${controlPlaneSha}`,
  ].join('\n');
  return Object.freeze({
    schema: SEAL_KEY_SCHEMA,
    source_sha: sourceSha,
    release_target: releaseTarget,
    physical_node: physicalNode,
    artifact_digest: artifactDigest,
    control_plane_sha: controlPlaneSha,
    serialization,
    seal_key: `sha256:${sha256(serialization)}`,
  });
}

export function sealObjectPaths(project, key, prefix = '') {
  exact(project, NAME_PATTERN, 'SEAL_PROJECT_INVALID');
  invariant(key?.schema === SEAL_KEY_SCHEMA, 'SEAL_KEY_SCHEMA_INVALID', 'Seal Key schema is unsupported');
  const normalizedPrefix = String(prefix).replace(/^\/+|\/+$/g, '');
  invariant(!normalizedPrefix.split('/').includes('..'), 'SEAL_PREFIX_INVALID', 'Seal prefix is invalid');
  const root = [
    normalizedPrefix,
    project,
    key.release_target,
    key.source_sha,
    'seals/v1',
    key.physical_node,
    key.artifact_digest.slice(7),
    key.control_plane_sha,
  ].filter(Boolean).join('/');
  return Object.freeze({
    root,
    identity: `${root}/seal-key.json`,
    leases: `${root}/leases/`,
    uploaded: `${root}/uploaded.json`,
    validated: `${root}/candidate-validation.json`,
    final: `${root}/final-seal.json`,
    failures: `${root}/failures/`,
  });
}

export function createSealLifecycleStore(client, options) {
  invariant(client && typeof client.putImmutable === 'function' && typeof client.getObject === 'function' && typeof client.listPrefix === 'function',
    'SEAL_STORE_INVALID', 'Seal lifecycle requires immutable get/put/list storage');
  const project = exact(options.project, NAME_PATTERN, 'SEAL_PROJECT_INVALID');
  const key = createSealKey(options);
  const paths = sealObjectPaths(project, key, options.prefix);
  const now = options.now ?? (() => new Date());

  return Object.freeze({ key, paths, read, begin, markUploaded, markValidated, seal, fail });

  async function read() {
    const [identity, uploaded, validated, final, objects] = await Promise.all([
      optionalJson(paths.identity), optionalJson(paths.uploaded), optionalJson(paths.validated), optionalJson(paths.final), client.listPrefix(paths.root),
    ]);
    if (identity) assertIdentity(identity);
    if (final) {
      assertFinal(final, validated);
      return state('SEALED', final.updated_at, { identity, uploaded, validated, final, receipt: final });
    }
    const leases = await jsonObjects(objects.filter((path) => path.startsWith(paths.leases) && /\/[0-9]+\.json$/.test(path)));
    const failures = await jsonObjects(objects.filter((path) => path.startsWith(paths.failures) && path.endsWith('.json')));
    const latestLease = leases.sort((left, right) => right.generation - left.generation)[0];
    const latestFailure = failures.sort(byUpdatedAt)[0];
    const progress = validated ?? uploaded ?? latestLease;
    const leaseRecoversFailure = latestLease?.recovers_failure === (latestFailure ? digest(latestFailure) : null);
    if (latestFailure && !leaseRecoversFailure && (!progress || Date.parse(latestFailure.updated_at) >= Date.parse(progress.updated_at))) {
      return state('FAILED', latestFailure.updated_at, {
        identity, uploaded, validated, lease: latestLease, failure: latestFailure, retryable: latestFailure.retryable,
      });
    }
    if (validated) return state('VALIDATED', validated.updated_at, { identity, uploaded, validated });
    if (uploaded) return state('UPLOADED', uploaded.updated_at, { identity, uploaded });
    if (latestLease) {
      const leaseExpired = Date.parse(latestLease.expires_at) <= now().getTime();
      return state('BUILDING', latestLease.updated_at, { identity, lease: latestLease, leaseExpired, retryable: leaseExpired });
    }
    return state('ABSENT', null, { identity: null, retryable: true });
  }

  async function begin({ requestId, leaseSeconds = 900, actorRole = 'build' }) {
    assertRole(actorRole, ['build', 'orchestrator'], 'SEAL_BEGIN_ROLE_FORBIDDEN');
    const request = requestIdValue(requestId);
    invariant(Number.isInteger(leaseSeconds) && leaseSeconds >= 30 && leaseSeconds <= 3600, 'SEAL_LEASE_INVALID', 'Seal lease must be 30-3600 seconds');
    await putIdentity();
    const current = await read();
    if (['SEALED', 'UPLOADED', 'VALIDATED'].includes(current.status)) return { ...current, action: 'resume', owner: false };
    if (current.status === 'FAILED' && current.retryable !== true) return { ...current, action: 'stop', owner: false };
    if (current.status === 'BUILDING' && !current.leaseExpired) {
      return { ...current, action: current.lease.request_id === request ? 'continue' : 'observe', owner: current.lease.request_id === request };
    }
    const generation = (current.lease?.generation ?? -1) + 1;
    const updatedAt = now().toISOString();
    const lease = {
      schema: 'ai.delivery.seal-lease.v1', seal_key: key.seal_key, generation, request_id: request,
      actor_role: actorRole, updated_at: updatedAt, expires_at: new Date(now().getTime() + leaseSeconds * 1000).toISOString(),
      recovers_failure: current.status === 'FAILED' ? digest(current.failure) : null,
    };
    try {
      await putJson(`${paths.leases}${generation}.json`, lease);
    } catch (error) {
      if (!(error instanceof DeliveryError) || error.code !== 'OSS_IMMUTABLE_OBJECT_CONFLICT') throw error;
      return { ...(await read()), action: 'observe', owner: false };
    }
    return { ...(await read()), action: current.status === 'ABSENT' ? 'build' : 'recover', owner: true };
  }

  async function markUploaded({ requestId, actorRole = 'build', artifact, provenance, buildRunner, routing = null, reused = false }) {
    assertRole(actorRole, ['build'], 'SEAL_UPLOAD_ROLE_FORBIDDEN');
    const current = await read();
    if (['UPLOADED', 'VALIDATED', 'SEALED'].includes(current.status)) {
      assertStageIdentity(current.uploaded, { artifact, provenance });
      return { receipt: current.uploaded, reused: true };
    }
    invariant(current.status === 'BUILDING', 'SEAL_UPLOAD_TRANSITION_INVALID', 'UPLOADED requires BUILDING');
    invariant(current.lease?.request_id === requestIdValue(requestId), 'SEAL_LEASE_NOT_OWNED', 'Only the active build lease owner may record UPLOADED');
    invariant(artifact?.digest === key.artifact_digest && typeof artifact?.object === 'string', 'SEAL_UPLOAD_ARTIFACT_MISMATCH', 'Uploaded artifact differs from Seal Key');
    invariant(typeof provenance?.object === 'string' && DIGEST_PATTERN.test(provenance?.digest ?? ''), 'SEAL_PROVENANCE_INVALID', 'Build provenance is missing or invalid');
    const receipt = {
      schema: 'ai.delivery.uploaded.v1', seal_key: key.seal_key, request_id: requestId, actor_role: actorRole,
      artifact, provenance, build_runner: requiredText(buildRunner, 'SEAL_BUILD_RUNNER_REQUIRED'), routing, reused: reused === true,
      completed_stages: ['BUILDING', 'UPLOADED'], updated_at: now().toISOString(),
    };
    const publication = await putJson(paths.uploaded, receipt);
    return { receipt, reused: publication.status === 'hit_remote' };
  }

  async function markValidated({ requestId, actorRole = 'release', validation, releaseRunner, reused = false }) {
    assertRole(actorRole, ['release'], 'SEAL_VALIDATE_ROLE_FORBIDDEN');
    const current = await read();
    if (['VALIDATED', 'SEALED'].includes(current.status)) {
      invariant(current.validated?.validation?.receipt_digest === validation?.receipt_digest,
        'SEAL_VALIDATION_CONFLICT', 'Existing candidate validation differs from this request');
      return { receipt: current.validated, reused: true };
    }
    invariant(current.status === 'UPLOADED', 'SEAL_VALIDATE_TRANSITION_INVALID', 'VALIDATED requires UPLOADED');
    invariant(validation?.ok === true && typeof validation?.receipt_digest === 'string' && DIGEST_PATTERN.test(validation.receipt_digest),
      'SEAL_VALIDATION_FAILED', 'Candidate validation must succeed before VALIDATED');
    const receipt = {
      schema: 'ai.delivery.candidate-validation.v1', seal_key: key.seal_key, request_id: requestIdValue(requestId), actor_role: actorRole,
      artifact: current.uploaded.artifact, provenance: current.uploaded.provenance, validation,
      build_runner: current.uploaded.build_runner, routing: current.uploaded.routing ?? null,
      release_runner: requiredText(releaseRunner, 'SEAL_RELEASE_RUNNER_REQUIRED'), reused: reused === true,
      completed_stages: ['BUILDING', 'UPLOADED', 'VALIDATED'], updated_at: now().toISOString(),
    };
    const publication = await putJson(paths.validated, receipt);
    return { receipt, reused: publication.status === 'hit_remote' };
  }

  async function seal({ requestId, actorRole = 'release' }) {
    assertRole(actorRole, ['release'], 'SEAL_FINALIZE_ROLE_FORBIDDEN');
    const current = await read();
    if (current.status === 'SEALED') return { receipt: current.final, reused: true };
    invariant(current.status === 'VALIDATED', 'SEAL_FINALIZE_TRANSITION_INVALID', 'SEALED requires VALIDATED');
    const unsigned = {
      schema: FINAL_SEAL_SCHEMA, seal_key_schema: SEAL_KEY_SCHEMA, seal_key: key.seal_key, key,
      request_id: requestIdValue(requestId), actor_role: actorRole,
      artifact: current.uploaded.artifact, provenance: current.uploaded.provenance,
      candidate_validation: { object: paths.validated, digest: digest(current.validated) },
      build_runner: current.uploaded.build_runner, routing: current.uploaded.routing ?? null, release_runner: current.validated.release_runner,
      reused_artifact: current.uploaded.reused, reused_validation: current.validated.reused,
      completed_stages: ['BUILDING', 'UPLOADED', 'VALIDATED', 'SEALED'], updated_at: now().toISOString(),
    };
    const receipt = { ...unsigned, seal_digest: digest(unsigned) };
    const publication = await putJson(paths.final, receipt);
    return { receipt, reused: publication.status === 'hit_remote' };
  }

  async function fail({ requestId, actorRole, stage, classification, retryable, reason, completedEvidence = [] }) {
    assertRole(actorRole, ['build', 'release', 'orchestrator'], 'SEAL_FAILURE_ROLE_FORBIDDEN');
    invariant(['BUILDING', 'UPLOADED', 'VALIDATED'].includes(stage), 'SEAL_FAILURE_STAGE_INVALID', 'Failure stage is invalid');
    const current = await read();
    const receipt = {
      schema: 'ai.delivery.seal-failure.v1', seal_key: key.seal_key, request_id: requestIdValue(requestId), actor_role: actorRole,
      failed_stage: stage, classification: requiredText(classification, 'SEAL_FAILURE_CLASS_REQUIRED'), retryable: retryable === true,
      reason: requiredText(reason, 'SEAL_FAILURE_REASON_REQUIRED'), completed_evidence: completedEvidence,
      last_safe_state: current.status === 'FAILED' ? current.failure?.last_safe_state ?? 'ABSENT' : current.status,
      updated_at: now().toISOString(),
    };
    const object = `${paths.failures}${receipt.updated_at.replace(/[:.]/g, '-')}-${receipt.request_id}.json`;
    await putJson(object, receipt);
    return { object, receipt };
  }

  async function putIdentity() {
    const identity = { ...key, project };
    await putJson(paths.identity, identity);
    return identity;
  }

  async function optionalJson(path) {
    try { return JSON.parse((await client.getObject(path, 'SEAL_OBJECT_NOT_FOUND')).toString('utf8')); }
    catch (error) {
      if (error instanceof DeliveryError && error.code === 'SEAL_OBJECT_NOT_FOUND') return null;
      throw error;
    }
  }

  async function jsonObjects(objects) {
    return Promise.all(objects.map(async (path) => JSON.parse((await client.getObject(path)).toString('utf8'))));
  }

  async function putJson(path, value) {
    return client.putImmutable(path, Buffer.from(prettyStableJson(value)), 'application/json');
  }

  function assertIdentity(identity) {
    invariant(identity.schema === SEAL_KEY_SCHEMA && identity.project === project && identity.seal_key === key.seal_key
      && identity.serialization === key.serialization, 'SEAL_KEY_CONFLICT', 'Stored Seal Key differs from the request');
  }

  function assertStageIdentity(uploaded, expected) {
    invariant(uploaded?.artifact?.digest === key.artifact_digest && uploaded.artifact.object === expected.artifact?.object
      && uploaded.provenance?.digest === expected.provenance?.digest && uploaded.provenance.object === expected.provenance?.object,
    'SEAL_UPLOADED_CONFLICT', 'Existing UPLOADED evidence differs');
  }

  function assertFinal(final, validated) {
    const claimed = final.seal_digest;
    const unsigned = { ...final };
    delete unsigned.seal_digest;
    invariant(final.schema === FINAL_SEAL_SCHEMA && final.seal_key === key.seal_key && claimed === digest(unsigned),
      'FINAL_SEAL_INVALID', 'Final Seal receipt is invalid');
    invariant(validated && final.candidate_validation?.digest === digest(validated), 'FINAL_SEAL_VALIDATION_MISMATCH', 'Final Seal validation evidence differs');
  }
}

export async function runSealLifecycle(store, options) {
  const requestId = requestIdValue(options.requestId);
  let current = await store.begin({ requestId, leaseSeconds: options.leaseSeconds ?? 900, actorRole: 'orchestrator' });
  if (current.status === 'SEALED') return result(store, current, true);
  if (current.action === 'observe') {
    current = await waitForTerminal(store, options.observeTimeoutMs ?? 5000, options.observeIntervalMs ?? 10);
    return result(store, current, current.status === 'SEALED');
  }
  if (current.status === 'FAILED' && current.retryable !== true) return result(store, current, false);
  try {
    current = await store.read();
    if (current.status === 'BUILDING' || current.status === 'FAILED') {
      const built = await options.build();
      invariant(built?.artifact?.digest === store.key.artifact_digest, 'SEAL_BUILD_DIGEST_MISMATCH', 'Build output differs from Seal Key');
      await store.markUploaded({ requestId, actorRole: 'build', ...built });
    }
    current = await store.read();
    if (current.status === 'UPLOADED') {
      const validated = await options.validate(current.uploaded);
      await store.markValidated({ requestId, actorRole: 'release', ...validated });
    }
    current = await store.read();
    if (current.status === 'VALIDATED') await store.seal({ requestId, actorRole: 'release' });
    return result(store, await store.read(), false);
  } catch (error) {
    const state = await store.read();
    const stage = state.status === 'UPLOADED' ? 'UPLOADED' : state.status === 'VALIDATED' ? 'VALIDATED' : 'BUILDING';
    await store.fail({ requestId, actorRole: stage === 'BUILDING' ? 'build' : 'release', stage,
      classification: error.code ?? 'UNEXPECTED', retryable: options.retryable?.(error) === true, reason: error.message,
      completedEvidence: [state.uploaded, state.validated].filter(Boolean) });
    return result(store, await store.read(), false);
  }
}

async function waitForTerminal(store, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  let current = await store.read();
  while (!['SEALED', 'FAILED'].includes(current.status) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    current = await store.read();
  }
  return current;
}

function result(store, current, reused) {
  return Object.freeze({
    schema: 'ai.delivery.seal-result.v1', sourceSha: store.key.source_sha, controlPlaneSha: store.key.control_plane_sha,
    target: store.key.release_target, physicalNode: store.key.physical_node, artifactDigest: store.key.artifact_digest,
    sealKey: store.key.seal_key, finalSealReceiptObject: store.paths.final, buildRunner: current.uploaded?.build_runner ?? null,
    releaseRunner: current.validated?.release_runner ?? null, routing: current.uploaded?.routing ?? null, status: current.status, reused: reused === true,
    failure: current.failure ? { classification: current.failure.classification, retryable: current.failure.retryable, reason: current.failure.reason } : null,
  });
}

function state(status, updatedAt, details) {
  invariant(SEAL_STATES.includes(status), 'SEAL_STATE_INVALID', 'Seal lifecycle state is invalid');
  return Object.freeze({ schema: SEAL_STATE_SCHEMA, status, updated_at: updatedAt, ...details });
}

function byUpdatedAt(left, right) { return Date.parse(right.updated_at) - Date.parse(left.updated_at); }
function requestIdValue(value) { return exact(value, REQUEST_PATTERN, 'SEAL_REQUEST_ID_INVALID'); }
function requiredText(value, code) { invariant(typeof value === 'string' && value.trim() !== '', code, code); return value; }
function exact(value, pattern, code) { invariant(typeof value === 'string' && pattern.test(value), code, code); return value; }
function assertRole(actual, allowed, code) { invariant(allowed.includes(actual), code, `Role ${actual ?? 'missing'} cannot perform this Seal transition`); }
