import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { MVP_REQUIREMENT_IDS } from '../../packages/contract/src/RequirementCatalog.ts';
import { isRequirementReleaseEvidence } from '../../tools/requirementgen/src/ReleaseEvidence.ts';
import { validateStage } from './stage.mjs';

const bundleRoot = process.argv[2] ? resolve(process.argv[2]) : undefined;
const outputRoot = process.argv[3] ? resolve(process.argv[3]) : undefined;
const receiptPath = process.argv[4] ? resolve(process.argv[4]) : undefined;
if (!bundleRoot || bundleRoot === '/' || !outputRoot || outputRoot === '/' || !receiptPath) throw new Error('REQUIREMENT_EVIDENCE_INPUTS_REQUIRED');

const candidateBytes = bytes('candidate.json');
const stageBytes = bytes('stage.json');
const releaseBytes = bytes('release.json');
const approvalBytes = bytes('promotion.json');
const signatureBytes = bytes('release.sigstore.json');
const candidate = JSON.parse(candidateBytes);
const stage = JSON.parse(stageBytes);
const release = JSON.parse(releaseBytes);
const approval = JSON.parse(approvalBytes);
const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
validateStage(stage, candidate, candidateBytes);
validateAuthority();
mkdirSync(outputRoot, { recursive: true });

for (const requirement of MVP_REQUIREMENT_IDS) {
  const evidence = Object.freeze({
    schema: 'shop.requirement.release.v1',
    requirement,
    commit: candidate.commit,
    sourceTreeHash: candidate.facts.sourceTreeHash,
    contractHash: candidate.contractHash,
    migrationHead: candidate.schemaHead,
    artifactDigest: candidate.commerce.sha256,
    bundle: Object.freeze({
      releaseId: release.releaseId,
      candidateSha256: hash(candidateBytes),
      stageSha256: hash(stageBytes),
      releaseSha256: hash(releaseBytes),
    }),
    schemaEvidence: Object.freeze({ head: candidate.schemaHead, sha256: candidate.facts.migrationHash }),
    config: Object.freeze({ sha256: candidate.facts.runtimeConfigHash }),
    tests: Object.freeze({ evidenceSha256: stage.requirements[requirement].evidenceSha256 }),
    metrics: Object.freeze({ evidenceSha256: stage.checks.metrics.evidenceSha256 }),
    approver: Object.freeze({ id: approval.approver.id, evidenceSha256: approval.approvalSha256 }),
    signedAt: approval.signedAt,
    signature: Object.freeze({ method: 'sigstore-keyless', bundleSha256: hash(signatureBytes) }),
    ...(requirement === 'MVPPROVIDER' ? { providers: Object.freeze(Object.keys(stage.providers).sort()) } : {}),
  });
  if (!isRequirementReleaseEvidence(evidence, requirement)) throw new Error(`REQUIREMENT_EVIDENCE_INVALID:${requirement}`);
  const target = join(outputRoot, `${requirement}.json`);
  if (existsSync(target)) throw new Error(`REQUIREMENT_EVIDENCE_ALREADY_EXISTS:${requirement}`);
  writeFileSync(target, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o444 });
}
console.log(`requirement release evidence generated: requirements=${MVP_REQUIREMENT_IDS.length} release=${release.releaseId}`);

function validateAuthority() {
  if (release.schema !== 'shop.release.v1' || release.commit !== candidate.commit || release.contractHash !== candidate.contractHash) throw new Error('REQUIREMENT_RELEASE_IDENTITY_INVALID');
  if (approval.schema !== 'shop.promotion.v1' || approval.commit !== candidate.commit || approval.stageSha256 !== hash(stageBytes)) throw new Error('REQUIREMENT_APPROVAL_INVALID');
  if (!approval.approver?.id || !Number.isSafeInteger(Date.parse(approval.signedAt))) throw new Error('REQUIREMENT_APPROVER_INVALID');
  if (receipt.schema !== 'shop.signatureverification.v1' || receipt.verified !== true || receipt.releaseSha256 !== hash(releaseBytes) || receipt.bundleSha256 !== hash(signatureBytes))
    throw new Error('REQUIREMENT_SIGNATURE_RECEIPT_INVALID');
}

function bytes(name) {
  const path = join(bundleRoot, name);
  if (!existsSync(path)) throw new Error(`REQUIREMENT_EVIDENCE_FILE_MISSING:${name}`);
  return readFileSync(path);
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}
