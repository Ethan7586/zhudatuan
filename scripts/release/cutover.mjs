import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { MVP_REQUIREMENT_IDS } from '../../packages/contract/src/RequirementCatalog.ts';

const sha = /^[0-9a-f]{64}$/;
const requiredChecks = ['databaseLockWait', 'databasePool', 'errorRate', 'financeBalance', 'latency', 'outboxLag', 'providerErrorRate', 'queueLag', 'scopeAlerts', 'transactionReconciliation'];
const requiredGlobalChecks = ['legacyAbsence', 'migration', 'providerHealth', 'requirements', 'smoke'];
const requiredTraffic = [1, 10, 50, 100];

export function validateCutover(evidence, release, releaseBytes, now = Date.now()) {
  if (evidence.schema !== 'shop.cutover.v1' || release.schema !== 'shop.release.v1') throw new Error('CUTOVER_SCHEMA_INVALID');
  if (evidence.releaseId !== release.releaseId || evidence.commit !== release.commit) throw new Error('CUTOVER_RELEASE_MISMATCH');
  if (evidence.releaseSha256 !== hash(releaseBytes)) throw new Error('CUTOVER_MANIFEST_MISMATCH');
  const completed = Date.parse(evidence.completedAt);
  if (!Number.isSafeInteger(completed) || completed > now + 300_000 || now - completed > 3_600_000) throw new Error('CUTOVER_EVIDENCE_STALE');
  if (JSON.stringify(evidence.traffic) !== JSON.stringify(requiredTraffic) || evidence.rollbackPolicy !== 'automatic' || evidence.databaseRepairPolicy !== 'forwardfix') throw new Error('CUTOVER_TRAFFIC_INVALID');
  for (const check of requiredGlobalChecks) {
    const result = evidence.checks?.[check];
    if (result?.passed !== true || !sha.test(result.evidenceSha256 ?? '')) throw new Error(`CUTOVER_CHECK_INVALID:${check}`);
  }
  if (evidence.migrationEvidence?.schema !== 'shop.migration.evidence.v1' || evidence.migrationEvidence?.passed !== true
    || typeof evidence.migrationEvidence?.exact !== 'boolean' || !Number.isSafeInteger(evidence.migrationEvidence?.approvedDifferences)
    || evidence.migrationEvidence.approvedDifferences < 0 || !sha.test(evidence.migrationEvidence?.archiveSha256 ?? '')) {
    throw new Error('CUTOVER_MIGRATION_EVIDENCE_INVALID');
  }
  if (evidence.migrationEvidence.exact !== (evidence.migrationEvidence.approvedDifferences === 0)) throw new Error('CUTOVER_MIGRATION_EVIDENCE_DECISION_INVALID');
  if (!Array.isArray(evidence.stages) || evidence.stages.length !== requiredTraffic.length) throw new Error('CUTOVER_STAGE_SET_INVALID');
  for (const [index, percentage] of requiredTraffic.entries()) {
    const stage = evidence.stages[index];
    if (stage?.percent !== percentage || stage?.decision !== 'promote') throw new Error(`CUTOVER_STAGE_INVALID:${percentage}`);
    if (
      Object.keys(stage.checks ?? {})
        .sort()
        .join(',') !== [...requiredChecks].sort().join(',')
    )
      throw new Error(`CUTOVER_STAGE_CHECK_SET_INVALID:${percentage}`);
    for (const check of requiredChecks) {
      const result = stage.checks[check];
      if (result?.passed !== true || !sha.test(result.evidenceSha256 ?? '')) throw new Error(`CUTOVER_STAGE_CHECK_INVALID:${percentage}:${check}`);
    }
  }
  if (
    evidence.results?.requirementsReleased !== MVP_REQUIREMENT_IDS.length ||
    evidence.results?.reconciliationDifference !== 0 ||
    evidence.results?.negativeInventory !== 0 ||
    evidence.results?.duplicateEffects !== 0 ||
    evidence.results?.unbalancedEntries !== 0 ||
    evidence.results?.scopeLeaks !== 0
  )
    throw new Error('CUTOVER_INVARIANT_INVALID');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const evidenceName = process.argv[2];
  const releaseName = process.argv[3];
  if (!evidenceName || !releaseName) throw new Error('CUTOVER_EVIDENCE_AND_RELEASE_REQUIRED');
  const evidence = JSON.parse(readFileSync(evidenceName, 'utf8'));
  const releaseBytes = readFileSync(releaseName);
  const release = JSON.parse(releaseBytes);
  validateCutover(evidence, release, releaseBytes);
  console.log(`cutover evidence valid: release=${release.releaseId} traffic=100 requirements=${MVP_REQUIREMENT_IDS.length} difference=0`);
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}
