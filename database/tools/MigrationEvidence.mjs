import { createHash } from 'node:crypto';

export const evidenceSchema = 'shop.migration.evidence.v1';
export const comparedMetricPaths = Object.freeze([
  'metrics.tableCounts',
  'metrics.distributions',
  'metrics.amountsMinor',
  'metrics.inventory',
  'metrics.voucher',
  'metrics.sampleHashes',
]);

export function validateMigrationEvidence(value) {
  if (value?.schema !== evidenceSchema || !['before', 'after'].includes(value.phase)) throw new Error('MIGRATION_EVIDENCE_SCHEMA_INVALID');
  if (!/^\d{14}$/.test(value.schemaHead?.migrationHead ?? '') || !/^[0-9a-f]{64}$/.test(value.schemaHead?.checksum ?? '')) {
    throw new Error('MIGRATION_EVIDENCE_HEAD_INVALID');
  }
  if (!Number.isSafeInteger(value.durationMs) || value.durationMs < 0 || !Number.isSafeInteger(value.maximumLockWaitMs) || value.maximumLockWaitMs < 0) {
    throw new Error('MIGRATION_EVIDENCE_RUNTIME_INVALID');
  }
  for (const path of comparedMetricPaths) if (at(value, path) === undefined) throw new Error(`MIGRATION_EVIDENCE_FIELD_MISSING:${path}`);
  if (typeof value.sampleSeed !== 'string' || value.sampleSeed.length < 16) throw new Error('MIGRATION_EVIDENCE_SAMPLE_SEED_INVALID');
  for (const field of ['orphanCount', 'duplicateBusinessKeyCount', 'undecryptableSecretCount', 'unbalancedJournalCount', 'negativeInventoryCount']) {
    if (!Number.isSafeInteger(value.invariants?.[field]) || value.invariants[field] < 0) throw new Error(`MIGRATION_EVIDENCE_FIELD_INVALID:${field}`);
  }
  if (value.invariants?.rls?.passed !== true || value.invariants.rls.scopeLeaks !== 0) throw new Error('MIGRATION_EVIDENCE_RLS_INVALID');
  if (!Array.isArray(value.checkpoints?.imports) || !Number.isSafeInteger(value.checkpoints?.migrationEvidenceCount)) {
    throw new Error('MIGRATION_EVIDENCE_CHECKPOINT_INVALID');
  }
  return value;
}

export function compareMigrationEvidence(before, after, approvals = [], limits = {}) {
  validateMigrationEvidence(before);
  validateMigrationEvidence(after);
  if (before.phase !== 'before' || after.phase !== 'after') throw new Error('MIGRATION_EVIDENCE_PHASE_INVALID');
  if (before.sampleSeed !== after.sampleSeed) throw new Error('MIGRATION_EVIDENCE_SAMPLE_SEED_DRIFT');
  if (limits.schemaHead && after.schemaHead.migrationHead !== limits.schemaHead) throw new Error('MIGRATION_EVIDENCE_TARGET_HEAD_INVALID');
  if (after.maximumLockWaitMs > (limits.maximumLockWaitMs ?? Number.MAX_SAFE_INTEGER)) throw new Error('MIGRATION_EVIDENCE_LOCK_WAIT_EXCEEDED');
  if (after.durationMs > (limits.maximumDurationMs ?? Number.MAX_SAFE_INTEGER)) throw new Error('MIGRATION_EVIDENCE_DURATION_EXCEEDED');
  for (const field of ['orphanCount', 'duplicateBusinessKeyCount', 'undecryptableSecretCount', 'unbalancedJournalCount', 'negativeInventoryCount']) {
    if (after.invariants[field] !== 0) throw new Error(`MIGRATION_EVIDENCE_INVARIANT_FAILED:${field}`);
  }
  const differences = comparedMetricPaths.flatMap((path) => deepDifferences(at(before, path), at(after, path), path));
  const approved = new Set();
  for (const difference of differences) {
    const approval = approvals.find((candidate) => candidate.path === difference.path);
    if (!approval || canonical(approval.source) !== canonical(difference.source) || canonical(approval.target) !== canonical(difference.target)
      || typeof approval.approvedBy !== 'string' || approval.approvedBy.length < 3 || typeof approval.reason !== 'string' || approval.reason.length < 8
      || !/^[0-9a-f]{64}$/.test(approval.evidenceSha256 ?? '')) throw new Error(`MIGRATION_EVIDENCE_DIFFERENCE_UNAPPROVED:${difference.path}`);
    approved.add(difference.path);
  }
  if (approvals.some((approval) => !approved.has(approval.path))) throw new Error('MIGRATION_EVIDENCE_UNUSED_APPROVAL');
  return Object.freeze({ exact: differences.length === 0, differences, approvals: differences.length, passed: true });
}

export function contentHash(value) {
  const copy = structuredClone(value);
  delete copy.contentSha256;
  return createHash('sha256').update(canonical(copy)).digest('hex');
}

function deepDifferences(source, target, path) {
  if (canonical(source) === canonical(target)) return [];
  if (plainObject(source) && plainObject(target)) {
    return [...new Set([...Object.keys(source), ...Object.keys(target)])]
      .sort()
      .flatMap((key) => deepDifferences(source[key], target[key], `${path}.${key}`));
  }
  return [{ path, source: source ?? null, target: target ?? null }];
}

function at(value, path) {
  return path.split('.').reduce((current, key) => current?.[key], value);
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (plainObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
