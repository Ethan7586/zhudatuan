import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { REQUIRED_PROVIDER_IDS } from '../../packages/contract/src/provider/ProviderCatalog';
import { MVP_REQUIREMENT_IDS } from '../../packages/contract/src/RequirementCatalog';
import { validateStage } from '../../scripts/release/stage.mjs';
import { validateCutover } from '../../scripts/release/cutover.mjs';

const sha = 'a'.repeat(64);
const now = Date.parse('2026-08-21T00:00:00.000Z');
const candidate = {
  schema: 'shop.candidate.v1',
  commit: 'b'.repeat(40),
  schemaHead: '20260829109000',
  contractHash: sha,
  clients: { auth: {}, console: {}, storefront: {} },
  commerce: { sha256: sha },
  sbom: { sha256: sha },
  provenance: { sha256: sha },
  facts: {
    sourceTreeHash: sha,
    contractHash: sha,
    operationHash: sha,
    eventHash: sha,
    jobHash: sha,
    jobCount: 33,
    requirementHash: sha,
    migrationHead: '20260829109000',
    migrationHash: sha,
    ownershipHash: sha,
    extensionHash: sha,
    runtimeConfigHash: sha,
    imageHash: sha,
    sbomHash: sha,
    provenanceHash: sha,
  },
};
const candidateBytes = Buffer.from(JSON.stringify(candidate));

function evidence() {
  const requirements = Object.fromEntries(MVP_REQUIREMENT_IDS.map((id) => [id, { accepted: true, evidenceSha256: sha }]));
  const providers = Object.fromEntries(
    REQUIRED_PROVIDER_IDS.map((id) => [
      id,
      {
        sandboxAccepted: true,
        reconciliationPassed: true,
        rollbackPassed: true,
        evidenceSha256: sha,
      },
    ])
  );
  const checks = Object.fromEntries(
    ['alertDelivery', 'databaseFreshReplay', 'databaseUpgrade', 'journey', 'performance', 'providerHealth', 'reconciliation', 'rollbackDrill', 'security', 'smoke', 'snapshotRestore'].map((id) => [id, { passed: true, evidenceSha256: sha }])
  );
  return {
    schema: 'shop.stage.v1',
    commit: candidate.commit,
    completedAt: new Date(now).toISOString(),
    candidateSha256: createHash('sha256').update(candidateBytes).digest('hex'),
    checks,
    requirements,
    providers,
  };
}

test('stage evidence closes all 22 semantic MVP requirements and 11 priority-one providers', () => {
  assert.doesNotThrow(() => validateStage(evidence(), candidate, candidateBytes, now));
});

test('stage evidence rejects a provider sandbox omission and stale acceptance', () => {
  const missing = evidence();
  missing.providers[REQUIRED_PROVIDER_IDS[0]!].sandboxAccepted = false;
  assert.throws(() => validateStage(missing, candidate, candidateBytes, now), /STAGE_PROVIDER_INVALID/);
  const stale = evidence();
  stale.completedAt = new Date(now - 86_400_001).toISOString();
  assert.throws(() => validateStage(stale, candidate, candidateBytes, now), /STAGE_EVIDENCE_STALE/);
});

test('cutover evidence binds the release and proves all production invariants at every traffic step', () => {
  const release = { schema: 'shop.release.v1', releaseId: 'release123', commit: candidate.commit };
  const releaseBytes = Buffer.from(JSON.stringify(release));
  const checks = Object.fromEntries(['legacyAbsence', 'migration', 'providerHealth', 'requirements', 'smoke'].map((id) => [id, { passed: true, evidenceSha256: sha }]));
  const stageChecks = Object.fromEntries(
    ['databaseLockWait', 'databasePool', 'errorRate', 'financeBalance', 'latency', 'outboxLag', 'providerErrorRate', 'queueLag', 'scopeAlerts', 'transactionReconciliation'].map((id) => [id, { passed: true, evidenceSha256: sha }])
  );
  const value = {
    schema: 'shop.cutover.v1',
    releaseId: release.releaseId,
    commit: release.commit,
    completedAt: new Date(now).toISOString(),
    releaseSha256: createHash('sha256').update(releaseBytes).digest('hex'),
    traffic: [1, 10, 50, 100],
    checks,
    rollbackPolicy: 'automatic',
    databaseRepairPolicy: 'forwardfix',
    stages: [1, 10, 50, 100].map((percent) => ({ percent, decision: 'promote', checks: stageChecks })),
    results: { requirementsReleased: MVP_REQUIREMENT_IDS.length, reconciliationDifference: 0, negativeInventory: 0, duplicateEffects: 0, unbalancedEntries: 0, scopeLeaks: 0 },
  };
  assert.doesNotThrow(() => validateCutover(value, release, releaseBytes, now));
  assert.throws(() => validateCutover({ ...value, results: { ...value.results, scopeLeaks: 1 } }, release, releaseBytes, now), /CUTOVER_INVARIANT_INVALID/);
});
