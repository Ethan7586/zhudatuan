// HISTORY-only 1.4.2 readiness scorer retained for its frozen baseline tests.
// The executable status path uses evaluateAuthoritativeDeliveryStatus below.
export function evaluateDeliveryStatus(input) {
  const committed = input.localCommit === true;
  const inMainline = input.inMainline === true;
  const latestPrepare = input.prepareRuns?.[0];
  const latestSeal = input.sealRuns?.[0];
  const sealed = input.sealAuthority?.status === 'SEALED';
  const deployable = inMainline && sealed && input.channelConfigured === true;

  let code = 'UNKNOWN_SOURCE';
  if (committed && !inMainline && input.conflictFiles?.length > 0) code = 'MERGE_CONFLICT';
  else if (committed && input.remoteCommit !== true) code = 'LOCAL_ONLY';
  else if (committed && !inMainline) code = 'AWAITING_INTEGRATION';
  else if (inMainline && input.channelConfigured !== true) code = 'CHANNEL_MISSING';
  else if (deployable) code = 'DEPLOYABLE';
  else if (isActive(latestSeal)) code = 'SEALING';
  else if (latestSeal?.status === 'completed' && latestSeal.conclusion !== 'success') code = 'SEAL_FAILED';
  else if (inMainline && input.sealAuthority?.status === 'UNAVAILABLE') code = 'SEAL_AUTHORITY_UNAVAILABLE';
  else if (inMainline && latestSeal?.conclusion === 'success' && !sealed) code = 'SEAL_RECEIPT_MISSING';
  else if (isActive(latestPrepare)) code = 'PREPARING';
  else if (latestPrepare?.status === 'completed' && latestPrepare.conclusion !== 'success') code = 'PREPARE_FAILED';
  else if (latestPrepare?.conclusion === 'success') code = 'AWAITING_SEAL';
  else if (inMainline) code = 'IN_MAINLINE';

  return Object.freeze({
    schemaVersion: 'zdt-delivery-status/v1',
    code,
    states: Object.freeze({ committed, inMainline, sealed, deployable }),
    remoteCommit: input.remoteCommit === true,
    channelConfigured: input.channelConfigured === true,
    conflictFiles: Object.freeze([...(input.conflictFiles ?? [])]),
    prepare: summarizeRun(latestPrepare),
    seal: summarizeRun(latestSeal),
    sealEvidence: sealed ? Object.freeze({
      sealKey: input.sealAuthority.sealKey,
      object: input.sealAuthority.object,
      artifactDigest: input.sealAuthority.artifactDigest,
      controlPlaneSha: input.sealAuthority.controlPlaneSha,
      updatedAt: input.sealAuthority.updatedAt,
    }) : undefined,
    sealAuthorityStatus: input.sealAuthority?.status ?? 'ABSENT',
  });
}

export const DELIVERY_CONTROL_VERSION = '1.4.3';
export const DELIVERY_STATUS_SCHEMA = 'zdt-delivery-status/v2';

export function evaluateAuthoritativeDeliveryStatus(input) {
  const lifecycle = input.sealLifecycle;
  const state = lifecycle?.state;
  const key = lifecycle?.key ?? null;
  const remoteAvailable = input.remote?.availability === 'AVAILABLE';
  const ossAvailable = lifecycle?.availability !== 'UNAVAILABLE';
  const evidenceCompleteness = !ossAvailable ? 'UNKNOWN' : remoteAvailable ? 'FULL' : 'PARTIAL';
  let status = 'NOT_PREPARED';
  let failureCode = null;

  if (!ossAvailable) {
    status = 'UNKNOWN';
    failureCode = lifecycle?.error ?? 'OSS_AUTHORITY_UNAVAILABLE';
  } else if (state?.status === 'FAILED') {
    status = 'FAILED';
    failureCode = state.failure?.classification ?? 'SEAL_LIFECYCLE_FAILED';
  } else if (state?.status === 'BUILDING') status = 'BUILDING';
  else if (state?.status === 'UPLOADED') status = 'UPLOADED';
  else if (state?.status === 'VALIDATED') status = 'VALIDATED';
  else if (state?.status === 'SEALED') {
    if (!remoteAvailable) {
      status = 'UNKNOWN';
      failureCode = input.remote?.error ?? 'REMOTE_AUTHORITY_UNAVAILABLE';
    } else {
      const candidate = input.remote.candidateSeal;
      const candidateArtifact = input.remote.candidateArtifact;
      const candidateMatches = candidate?.schema === 'ai.delivery.candidate-seal.v1'
        && candidate.sourceSha === key?.source_sha
        && candidate.artifactSha256 === key?.artifact_digest
        && candidate.controlPlane?.sourceSha === key?.control_plane_sha
        && input.remote.candidate === candidate.candidate
        && candidateArtifact?.sourceSha === key?.source_sha
        && candidateArtifact?.archive?.sha256 === key?.artifact_digest;
      if (!candidateMatches) {
        status = 'FAILED';
        failureCode = 'AUTHORITATIVE_SEAL_CONFLICT';
      } else {
        const currentAllowed = input.remote.current === candidate.expectedCurrent || input.remote.current === candidate.candidate;
        const currentMatches = artifactMatches(input.remote.currentArtifact, key) && input.remote.current === candidate.candidate;
        status = currentAllowed && currentMatches ? 'DEPLOYED' : currentAllowed ? 'SEALED' : 'FAILED';
        if (!currentAllowed) failureCode = 'CURRENT_POINTER_CONFLICT';
        else if (input.remote.currentArtifact?.sourceSha === key?.source_sha && !artifactMatches(input.remote.currentArtifact, key)) {
          status = 'FAILED';
          failureCode = 'CURRENT_ARTIFACT_CONFLICT';
        }
      }
    }
  }

  const final = state?.final ?? null;
  const uploaded = state?.uploaded ?? null;
  const validated = state?.validated ?? null;
  return Object.freeze({
    schemaVersion: DELIVERY_STATUS_SCHEMA,
    deliveryControlVersion: DELIVERY_CONTROL_VERSION,
    status,
    sourceSha: input.sourceSha,
    controlPlaneSha: key?.control_plane_sha ?? null,
    target: input.target,
    physicalNode: input.physicalNode,
    artifactDigest: key?.artifact_digest ?? null,
    sealKey: key?.seal_key ?? null,
    finalSealReceipt: final ? { object: lifecycle.paths?.final ?? null, receipt: final } : null,
    candidateSeal: input.remote?.candidateSeal ?? null,
    current: pointerEvidence(input.remote?.current, input.remote?.currentArtifact, key),
    previous: pointerEvidence(input.remote?.previous, input.remote?.previousArtifact, key),
    activeReleaseWriter: input.writer?.leaseStatus === 'ACTIVE' ? input.writer : null,
    buildRunner: uploaded?.build_runner ?? null,
    releaseRunner: validated?.release_runner ?? final?.release_runner ?? null,
    reused: Boolean(final?.reused_artifact || final?.reused_validation || input.writer?.reused),
    evidence: Object.freeze({ completeness: evidenceCompleteness, oss: ossAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
      sealLifecycle: state?.status ?? 'UNAVAILABLE',
      remote: remoteAvailable ? 'AVAILABLE' : 'UNAVAILABLE', actions: input.latestAction ? 'AUXILIARY' : 'ABSENT' }),
    failureCode,
    recentActionUrl: input.latestAction?.url ?? null,
  });
}

export function parseMergeTreeConflictFiles(output) {
  const lines = String(output).split(/\r?\n/);
  const separator = lines.indexOf('');
  const candidates = lines.slice(1, separator < 0 ? lines.length : separator);
  return Object.freeze(candidates.filter((line) => line !== '' && !/^[0-9a-f]{40}$/.test(line)));
}

export function automaticClosureIncludes(closure, { sourceSha, target, node }) {
  if (closure?.schemaVersion !== 'zdt-automatic-artifact-closure/v1' || closure.sourceSha !== sourceSha) return false;
  return ['migrations', 'runtimes', 'frontends']
    .flatMap((wave) => Array.isArray(closure.waves?.[wave]) ? closure.waves[wave] : [])
    .some((entry) => entry?.target === target && entry?.node === node);
}

function isActive(run) {
  return run?.status === 'queued' || run?.status === 'in_progress' || run?.status === 'waiting';
}

function summarizeRun(run) {
  if (run === undefined) return undefined;
  return Object.freeze({
    id: run.databaseId,
    status: run.status,
    conclusion: run.conclusion ?? null,
    url: run.url,
    createdAt: run.createdAt,
  });
}

function artifactMatches(artifact, key) {
  return Boolean(artifact && key && artifact.sourceSha === key.source_sha && artifact.archive?.sha256 === key.artifact_digest);
}

function pointerEvidence(path, artifact, key) {
  return path ? Object.freeze({ path, sourceSha: artifact?.sourceSha ?? null, artifactDigest: artifact?.archive?.sha256 ?? null,
    matchesSeal: artifactMatches(artifact, key) }) : null;
}
