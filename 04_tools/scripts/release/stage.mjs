import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { REQUIRED_PROVIDER_IDS } from '../../../01_core_hexin/packages/contract/src/provider/ProviderCatalog.ts';

const sha = /^[0-9a-f]{64}$/;
const requiredChecks = [
  'alertDelivery',
  'databaseFreshReplay',
  'databaseUpgrade',
  'journey',
  'performance',
  'providerHealth',
  'reconciliation',
  'rollbackDrill',
  'security',
  'smoke',
  'snapshotRestore',
];
const requirementIds = Array.from({ length: 21 }, (_, index) => `MVP${String(index + 3).padStart(2, '0')}`);

export function validateStage(stage, candidate, candidateBytes, now = Date.now()) {
  if (stage.schema !== 'shop.stage.v1') throw new Error('STAGE_SCHEMA_INVALID');
  if (candidate.schema !== 'shop.candidate.v1') throw new Error('CANDIDATE_SCHEMA_INVALID');
  if (stage.commit !== candidate.commit) throw new Error('STAGE_COMMIT_MISMATCH');
  if (stage.candidateSha256 !== hash(candidateBytes)) throw new Error('STAGE_CANDIDATE_MISMATCH');
  if (!Number.isSafeInteger(Date.parse(stage.completedAt))) throw new Error('STAGE_TIME_INVALID');
  if (now - Date.parse(stage.completedAt) > 86_400_000 || Date.parse(stage.completedAt) > now + 300_000) throw new Error('STAGE_EVIDENCE_STALE');
  for (const check of requiredChecks) {
    const value = stage.checks?.[check];
    if (value?.passed !== true || !sha.test(value.evidenceSha256 ?? '')) throw new Error(`STAGE_CHECK_INVALID:${check}`);
  }
  if (Object.keys(stage.requirements ?? {}).sort().join(',') !== requirementIds.join(',')) throw new Error('STAGE_REQUIREMENT_SET_INVALID');
  for (const id of requirementIds) {
    const value = stage.requirements[id];
    if (value.accepted !== true || !sha.test(value.evidenceSha256 ?? '')) throw new Error(`STAGE_REQUIREMENT_INVALID:${id}`);
  }
  if (Object.keys(stage.providers ?? {}).sort().join(',') !== [...REQUIRED_PROVIDER_IDS].sort().join(',')) throw new Error('STAGE_PROVIDER_SET_INVALID');
  for (const id of REQUIRED_PROVIDER_IDS) {
    const value = stage.providers[id];
    if (value.sandboxAccepted !== true || value.reconciliationPassed !== true || value.rollbackPassed !== true
      || !sha.test(value.evidenceSha256 ?? '')) throw new Error(`STAGE_PROVIDER_INVALID:${id}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const stageName = process.argv[2];
  const candidateName = process.argv[3];
  if (!stageName || !candidateName) throw new Error('STAGE_AND_CANDIDATE_REQUIRED');
  const stage = JSON.parse(readFileSync(stageName, 'utf8'));
  const candidateBytes = readFileSync(candidateName);
  const candidate = JSON.parse(candidateBytes);
  validateStage(stage, candidate, candidateBytes);
  console.log(`stage evidence valid: commit=${stage.commit} requirements=21 providers=${REQUIRED_PROVIDER_IDS.length}`);
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}
