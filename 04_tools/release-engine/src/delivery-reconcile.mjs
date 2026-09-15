import { DeliveryError, invariant, redactDeliveryDetails } from './errors.mjs';
import { createSealKey, FINAL_SEAL_SCHEMA } from './seal-lifecycle.mjs';
import { digest } from './stable.mjs';

export const RECONCILE_SCHEMA = 'ai.delivery.authoritative-reconcile.v1';
export const BUNDLE_GATE_SCHEMA = 'ai.delivery.release-bundle-gate.v1';
export const RECONCILE_STATES = Object.freeze([
  'ABSENT', 'BUILDING', 'UPLOADED', 'VALIDATED', 'SEALING', 'SEALED',
  'FAILED_RETRYABLE', 'FAILED_BLOCKED', 'AMBIGUOUS_WRITE', 'OWNER_CONFLICT',
]);
export const RECONCILE_ACTIONS = Object.freeze([
  'NOOP_ALREADY_SEALED', 'RESUME_UPLOAD', 'RESUME_VALIDATION', 'RESUME_FINAL_SEAL_WRITE',
  'REFRESH_CREDENTIAL_AND_RETRY', 'STOP_SECURITY_MISMATCH', 'STOP_PERMISSION_DENIED', 'STOP_OWNER_CONFLICT', 'STOP_RETRY_BUDGET_EXHAUSTED',
]);

export async function reconcileDeliveryState(input, dependencies = {}) {
  const identity = exactIdentity(input);
  const resources = exactResources(input.resources);
  const now = dependencies.now?.() ?? new Date();
  const retryBudget = integer(input.retryPolicy?.budget ?? 3, 0, 10, 'RECONCILE_RETRY_BUDGET_INVALID');
  const retryCount = integer(input.retryPolicy?.count ?? 0, 0, retryBudget, 'RECONCILE_RETRY_COUNT_INVALID');
  const client = dependencies.client;
  invariant(client && typeof client.getObject === 'function', 'RECONCILE_CLIENT_REQUIRED', 'Reconcile requires exact object reads');
  const reads = await Promise.all([
    exactJson(client, resources.uploaded), exactJson(client, resources.validated), exactJson(client, resources.final),
  ]);
  const denial = reads.find((item) => item.denial)?.denial;
  const [uploaded, validated, final] = reads.map((item) => item.value);
  const key = createSealKey({ sourceSha: identity.sourceSha, controlPlaneSha: identity.controlPlaneSha,
    releaseTarget: identity.target, physicalNode: identity.physicalNode, artifactDigest: identity.artifactDigest });
  const context = { identity, resources, key, uploaded, validated, final, now, retryBudget, retryCount, input };

  if (denial) return output(context, 'FAILED_BLOCKED', 'STOP_PERMISSION_DENIED', {
    failureClass: denial.failureClass, retryable: false, resumeAllowed: true, resumeFrom: checkpoint(uploaded, validated),
    nextSafeAction: 'repair-exact-role-action-resource-policy-run-doctor-then-resume', exactResource: denial.exactResource,
    denial: { identity: safeIdentity(input.credentialSummary?.subject ?? input.credentialSummary?.provider),
      roleKind: input.expectedRole, ossAction: denial.ossAction },
  });

  const conflict = evidenceConflict(context);
  if (conflict) return output(context, 'FAILED_BLOCKED', 'STOP_SECURITY_MISMATCH', {
    failureClass: conflict, retryable: false, resumeAllowed: false, resumeFrom: null,
    nextSafeAction: 'stop-and-review-exact-artifact-identity', exactResource: conflictResource(conflict, resources),
  });

  if (final) return output(context, 'SEALED', 'NOOP_ALREADY_SEALED', {
    failureClass: null, retryable: false, resumeAllowed: false, resumeFrom: null,
    nextSafeAction: 'accept-idempotent-success', exactResource: resources.final,
  });

  const ownerConflict = activeOwnerConflict(input.control, identity, now);
  if (ownerConflict) return output(context, 'OWNER_CONFLICT', 'STOP_OWNER_CONFLICT', {
    failureClass: 'ACTIVE_OWNER_CONFLICT', retryable: false, resumeAllowed: false, resumeFrom: input.control?.checkpoint ?? null,
    nextSafeAction: 'wait-for-authoritative-lease-expiry-or-owner-completion', exactResource: input.control.lease.exactResource,
  });

  const failure = input.failure ?? null;
  if (failure?.kind === 'permission-denied') return output(context, 'FAILED_BLOCKED', 'STOP_PERMISSION_DENIED', {
    failureClass: failure.failureClass ?? 'OSS_PERMISSION_DENIED', retryable: false, resumeAllowed: true,
    resumeFrom: checkpoint(uploaded, validated), nextSafeAction: 'repair-exact-role-action-resource-policy-run-doctor-then-resume',
    exactResource: requiredText(failure.exactResource, 'RECONCILE_EXACT_RESOURCE_REQUIRED'),
    denial: { identity: safeIdentity(failure.identity), roleKind: failure.roleKind ?? input.expectedRole,
      ossAction: failure.ossAction ?? null },
  });
  if (failure?.kind === 'credential-expired') {
    if (retryCount >= retryBudget) return output(context, 'FAILED_BLOCKED', 'STOP_RETRY_BUDGET_EXHAUSTED', {
      failureClass: 'STS_CREDENTIAL_RETRY_EXHAUSTED', retryable: false, resumeAllowed: false, resumeFrom: checkpoint(uploaded, validated),
      nextSafeAction: 'run-doctor-and-start-a-new-authorized-attempt', exactResource: failure.exactResource ?? resources.final,
    });
    return output(context, 'FAILED_RETRYABLE', 'REFRESH_CREDENTIAL_AND_RETRY', {
      failureClass: 'STS_CREDENTIAL_EXPIRED', retryable: true, resumeAllowed: true, resumeFrom: checkpoint(uploaded, validated),
      nextSafeAction: 'refresh-short-lived-credential-with-backoff-and-retry-same-exact-operation', exactResource: failure.exactResource ?? resources.final,
    });
  }
  if (failure?.kind === 'ambiguous-write' || input.control?.checkpoint === 'SEALING') {
    if (retryCount >= retryBudget) return output(context, 'FAILED_BLOCKED', 'STOP_RETRY_BUDGET_EXHAUSTED', {
      failureClass: 'FINAL_SEAL_WRITE_RETRY_EXHAUSTED', retryable: false, resumeAllowed: false, resumeFrom: 'FINAL_SEAL_WRITE',
      nextSafeAction: 'run-doctor-and-review-exact-final-seal-resource', exactResource: resources.final,
    });
    return output(context, 'AMBIGUOUS_WRITE', 'RESUME_FINAL_SEAL_WRITE', {
      failureClass: 'FINAL_SEAL_WRITE_OUTCOME_UNKNOWN', retryable: true, resumeAllowed: true,
      resumeFrom: 'FINAL_SEAL_WRITE', nextSafeAction: 'exact-readback-completed-final-absent-retry-once-within-budget', exactResource: resources.final,
    });
  }
  if (validated) return output(context, 'FAILED_RETRYABLE', 'RESUME_FINAL_SEAL_WRITE', {
    failureClass: 'FINAL_SEAL_MISSING_AFTER_VALIDATION', retryable: true, resumeAllowed: true, resumeFrom: 'FINAL_SEAL_WRITE',
    nextSafeAction: 'write-final-seal-once-then-exact-readback', exactResource: resources.final,
  });
  if (uploaded) return output(context, 'UPLOADED', 'RESUME_VALIDATION', {
    failureClass: null, retryable: true, resumeAllowed: true, resumeFrom: 'VALIDATION',
    nextSafeAction: 'validate-existing-uploaded-artifact', exactResource: resources.validated,
  });
  return output(context, input.control?.checkpoint === 'BUILDING' ? 'BUILDING' : 'ABSENT', 'RESUME_UPLOAD', {
    failureClass: null, retryable: true, resumeAllowed: true, resumeFrom: 'UPLOAD',
    nextSafeAction: 'build-or-upload-under-the-authoritative-owner-lease', exactResource: resources.uploaded,
  });
}

export async function executeWithCredentialRefresh(operation, options = {}) {
  const budget = integer(options.budget ?? 2, 1, 3, 'STS_REFRESH_BUDGET_INVALID');
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const random = options.random ?? Math.random;
  const audit = [];
  let credential = options.credential;
  for (let attempt = 1; attempt <= budget; attempt += 1) {
    try { return Object.freeze({ value: await operation({ credential, attempt }), attempts: attempt, audit: Object.freeze(audit) }); }
    catch (error) {
      if (error?.code !== 'STS_CREDENTIAL_EXPIRED' || attempt === budget) throw error;
      const base = Number(options.baseDelayMs ?? 250) * (2 ** (attempt - 1));
      const delayMs = Math.round(base + base * 0.25 * random());
      audit.push(Object.freeze({ event: 'sts-credential-refresh', attempt, delayMs, exactResource: options.exactResource }));
      await sleep(delayMs);
      credential = await options.refresh({ attempt, exactResource: options.exactResource });
    }
  }
}

export function evaluateReleaseBundle(input) {
  const required = Array.isArray(input.requiredComponents) ? input.requiredComponents : [];
  invariant(required.length > 0, 'BUNDLE_COMPONENTS_REQUIRED', 'Release bundle requires at least one component');
  const byId = new Map((input.componentStates ?? []).map((item) => [item.componentId, item]));
  const components = required.map((expected) => {
    const actual = byId.get(expected.componentId);
    const identityMatches = actual?.sourceSha === input.sourceSha && actual?.controlPlaneSha === input.controlPlaneSha
      && actual?.target === expected.target && actual?.physicalNode === expected.physicalNode
      && actual?.artifactDigest === expected.artifactDigest;
    return Object.freeze({ componentId: expected.componentId, status: actual?.state ?? 'ABSENT', identityMatches,
      finalSealed: actual?.state === 'SEALED' && identityMatches, exactResource: actual?.exactResource ?? expected.exactResource });
  });
  const allowDeploy = components.every((item) => item.finalSealed);
  return Object.freeze({ schema: BUNDLE_GATE_SCHEMA, sourceSha: input.sourceSha, controlPlaneSha: input.controlPlaneSha,
    allowDeploy, action: allowDeploy ? 'ALLOW_CONTRACT_DEPLOY' : 'DENY_DEPLOY_INCOMPLETE_BUNDLE', components,
    nextSafeAction: allowDeploy ? 'fourth-batch-may-consume-this-gate' : 'resume-only-incomplete-components-until-all-final-sealed' });
}

function evidenceConflict({ key, uploaded, validated, final }) {
  if (uploaded && (uploaded.schema !== 'ai.delivery.uploaded.v1' || uploaded.seal_key !== key.seal_key
    || uploaded.artifact?.digest !== key.artifact_digest || !/^sha256:[a-f0-9]{64}$/.test(uploaded.provenance?.digest ?? ''))) return 'UPLOADED_IDENTITY_MISMATCH';
  if (validated && (validated.schema !== 'ai.delivery.candidate-validation.v1' || !uploaded || validated.seal_key !== key.seal_key
    || validated.artifact?.digest !== key.artifact_digest || validated.provenance?.digest !== uploaded.provenance?.digest
    || digest(uploaded) !== validated?.candidate_input_digest && validated?.candidate_input_digest !== undefined)) return 'VALIDATED_IDENTITY_MISMATCH';
  if (final) {
    const claimed = final.seal_digest; const unsigned = { ...final }; delete unsigned.seal_digest;
    if (final.schema !== FINAL_SEAL_SCHEMA || final.seal_key !== key.seal_key || claimed !== digest(unsigned)
      || final.key?.source_sha !== key.source_sha || final.key?.control_plane_sha !== key.control_plane_sha
      || final.key?.release_target !== key.release_target || final.key?.physical_node !== key.physical_node
      || final.key?.artifact_digest !== key.artifact_digest || final.artifact?.digest !== key.artifact_digest
      || final.provenance?.digest !== uploaded?.provenance?.digest || !validated
      || final.candidate_validation?.digest !== digest(validated)) return 'FINAL_SEAL_IDENTITY_MISMATCH';
  }
  return null;
}

function output(context, state, action, decision) {
  invariant(RECONCILE_STATES.includes(state) && RECONCILE_ACTIONS.includes(action), 'RECONCILE_OUTPUT_INVALID', 'Unknown reconcile result');
  const completedEvidence = [context.uploaded && context.resources.uploaded, context.validated && context.resources.validated,
    context.final && context.resources.final].filter(Boolean);
  const raw = { schema: RECONCILE_SCHEMA, state, action, ...context.identity, requestId: context.input.requestId,
    attemptId: context.input.attemptId, expectedRole: context.input.expectedRole, owner: context.input.control?.owner ?? null,
    lease: context.input.control?.lease ?? null, completedEvidence, ...decision, retryCount: context.retryCount,
    retryBudget: context.retryBudget, timestamp: context.now.toISOString() };
  return Object.freeze(redactDeliveryDetails(raw, context.input.secretValues));
}

async function exactJson(client, resource) {
  try { return { value: JSON.parse((await client.getObject(resource, 'RECONCILE_OBJECT_NOT_FOUND')).toString('utf8')) }; }
  catch (error) {
    if (error instanceof DeliveryError && error.code === 'RECONCILE_OBJECT_NOT_FOUND') return { value: null };
    const status = Number(error?.details?.status ?? error?.status ?? 0);
    if (status === 403 || /DENIED|FORBIDDEN|UNAUTHORIZED/.test(error?.code ?? '')) return { value: null, denial: {
      failureClass: /ImplicitDeny/i.test(error?.details?.detail ?? error?.message ?? '') ? 'OSS_IMPLICIT_DENY' : 'OSS_PERMISSION_DENIED',
      exactResource: resource, ossAction: 'oss:GetObject',
    } };
    throw error;
  }
}
function checkpoint(uploaded, validated) { return validated ? 'FINAL_SEAL_WRITE' : uploaded ? 'VALIDATION' : 'UPLOAD'; }
function conflictResource(conflict, resources) { return conflict.startsWith('FINAL') ? resources.final : conflict.startsWith('VALIDATED') ? resources.validated : resources.uploaded; }
function activeOwnerConflict(control, identity, now) { return Boolean(control?.owner && control.owner !== identity.requestOwner
  && control.lease?.expiresAt && Date.parse(control.lease.expiresAt) > now.getTime()); }
function safeIdentity(value) { return value ? `${String(value).slice(0, 12)}…[REDACTED]` : null; }
function exactIdentity(input) {
  const identity = { sourceSha: exact(input.sourceSha, /^[a-f0-9]{40}$/, 'RECONCILE_SOURCE_SHA_INVALID'),
    controlPlaneSha: exact(input.controlPlaneSha, /^[a-f0-9]{40}$/, 'RECONCILE_CONTROL_SHA_INVALID'),
    target: exact(input.target, /^[A-Za-z0-9][A-Za-z0-9_.-]*$/, 'RECONCILE_TARGET_INVALID'),
    physicalNode: exact(input.physicalNode, /^[A-Za-z0-9][A-Za-z0-9_.-]*$/, 'RECONCILE_NODE_INVALID'),
    artifactDigest: exact(input.artifactDigest, /^sha256:[a-f0-9]{64}$/, 'RECONCILE_ARTIFACT_DIGEST_INVALID'),
    requestOwner: requiredText(input.requestOwner ?? input.requestId, 'RECONCILE_OWNER_REQUIRED') };
  requiredText(input.requestId, 'RECONCILE_REQUEST_ID_REQUIRED'); requiredText(input.attemptId, 'RECONCILE_ATTEMPT_ID_REQUIRED');
  invariant(['observer', 'builder', 'releaser'].includes(input.expectedRole), 'RECONCILE_ROLE_INVALID', 'Expected role is invalid');
  return identity;
}
function exactResources(value = {}) { return Object.freeze({ uploaded: requiredText(value.uploaded, 'RECONCILE_UPLOADED_RESOURCE_REQUIRED'),
  validated: requiredText(value.validated, 'RECONCILE_VALIDATED_RESOURCE_REQUIRED'), final: requiredText(value.final, 'RECONCILE_FINAL_RESOURCE_REQUIRED') }); }
function integer(value, min, max, code) { invariant(Number.isInteger(value) && value >= min && value <= max, code, code); return value; }
function exact(value, pattern, code) { invariant(typeof value === 'string' && pattern.test(value), code, code); return value; }
function requiredText(value, code) { invariant(typeof value === 'string' && value.length > 0, code, code); return value; }
