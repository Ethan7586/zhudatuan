import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { REQUIRED_PROVIDER_IDS } from '../../../01_core_hexin/packages/contract/src/provider/ProviderCatalog';
import { validateStage } from '../../../04_tools/scripts/release/stage.mjs';
import { validateCutover } from '../../../04_tools/scripts/release/cutover.mjs';

const sha = 'a'.repeat(64);
const now = Date.parse('2026-08-21T00:00:00.000Z');
const candidate = { schema: 'shop.candidate.v1', commit: 'b'.repeat(40) };
const candidateBytes = Buffer.from(JSON.stringify(candidate));

function evidence() {
  const requirements = Object.fromEntries(Array.from({ length: 21 }, (_, index) => [
    `MVP${String(index + 3).padStart(2, '0')}`,
    { accepted: true, evidenceSha256: sha },
  ]));
  const providers = Object.fromEntries(REQUIRED_PROVIDER_IDS.map((id) => [id, {
    sandboxAccepted: true,
    reconciliationPassed: true,
    rollbackPassed: true,
    evidenceSha256: sha,
  }]));
  const checks = Object.fromEntries(['alertDelivery', 'databaseFreshReplay', 'databaseUpgrade', 'journey', 'performance',
    'providerHealth', 'reconciliation', 'rollbackDrill', 'security', 'smoke', 'snapshotRestore'].map((id) => [id, { passed: true, evidenceSha256: sha }]));
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

test('stage evidence closes all 21 MVP requirements and 11 priority-one providers', () => {
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
  const checks = Object.fromEntries(['legacyAbsence', 'migration', 'providerHealth', 'reconciliation', 'requirements', 'scope', 'sli', 'smoke']
    .map((id) => [id, { passed: true, evidenceSha256: sha }]));
  const value = { schema: 'shop.cutover.v1', releaseId: release.releaseId, commit: release.commit, completedAt: new Date(now).toISOString(),
    releaseSha256: createHash('sha256').update(releaseBytes).digest('hex'), traffic: [5, 25, 50, 100], checks,
    results: { requirementsReleased: 21, reconciliationDifference: 0, negativeInventory: 0, duplicateEffects: 0, unbalancedEntries: 0, scopeLeaks: 0 } };
  assert.doesNotThrow(() => validateCutover(value, release, releaseBytes, now));
  assert.throws(() => validateCutover({ ...value, results: { ...value.results, scopeLeaks: 1 } }, release, releaseBytes, now), /CUTOVER_INVARIANT_INVALID/);
});
