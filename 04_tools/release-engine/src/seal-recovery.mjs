import { invariant } from './errors.mjs';

export const SEAL_RESUME_SCHEMA = 'ai.delivery.seal-resume-decision.v1';

export function classifySealCheckpoint(input) {
  const exactResource = required(input.exactResource);
  const base = { schema: SEAL_RESUME_SCHEMA, exactResource };
  if (input.identityMismatch) return decision(base, 'SEAL_IDENTITY_MISMATCH', false, false, null, 'stop-and-review-seal-identity');
  if (input.permissionDenied) return decision(base, 'OSS_PERMISSION_DENIED', false, true, input.safeCheckpoint ?? null,
    'repair-exact-role-action-resource-policy-and-resume-from-safe-checkpoint', {
      identity: input.identity ?? null, roleKind: input.roleKind ?? null, ossAction: input.ossAction ?? null,
    });
  if (input.credentialExpired) return decision(base, 'STS_CREDENTIAL_EXPIRED', true, true, input.safeCheckpoint ?? null,
    'refresh-short-lived-credential-and-retry-exact-operation', { maxAttempts: input.maxAttempts ?? 3 });
  if (input.writeOutcomeUnknown) return decision(base, 'FINAL_SEAL_WRITE_OUTCOME_UNKNOWN', true, true, 'EXACT_FINAL_SEAL_READBACK',
    'exact-head-get-final-seal-before-any-retry');
  if (input.finalSeal) return decision(base, 'FINAL_SEAL_ALREADY_VALID', false, false, null, 'accept-idempotent-success');
  if (input.uploaded && input.validated) return decision(base, 'FINAL_SEAL_MISSING_AFTER_VALIDATION', true, true,
    'RESUME_FROM_FINAL_SEAL_WRITE', 'write-final-seal-once-then-exact-readback');
  return decision(base, 'FINAL_SEAL_EVIDENCE_INCOMPLETE', false, false, null, 'restore-missing-prior-stage-evidence');
}

export function assertExactSealIdentity(receipt, expected) {
  invariant(receipt?.key?.source_sha === expected.sourceSha
    && receipt.key.control_plane_sha === expected.controlPlaneSha
    && receipt.key.release_target === expected.target
    && receipt.key.physical_node === expected.node
    && receipt.key.artifact_digest === expected.artifactDigest,
  'FINAL_SEAL_IDENTITY_MISMATCH', 'Final Seal identity differs from the exact request', {
    failureClass: 'SEAL_IDENTITY_MISMATCH', retryable: false, resumeAllowed: false, resumeFrom: null,
    nextSafeAction: 'stop-and-review-seal-identity', exactResource: expected.exactResource,
  });
}

function decision(base, failureClass, retryable, resumeAllowed, resumeFrom, nextSafeAction, audit = {}) {
  return Object.freeze({ ...base, failureClass, retryable, resumeAllowed, resumeFrom, nextSafeAction, audit });
}
function required(value) { invariant(typeof value === 'string' && value.length > 0, 'SEAL_EXACT_RESOURCE_REQUIRED', 'Exact Seal resource is required'); return value; }
