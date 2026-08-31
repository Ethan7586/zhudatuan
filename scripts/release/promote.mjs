import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { validateStage } from './stage.mjs';

const candidateName = process.argv[2];
const stageName = process.argv[3];
const approvalName = process.argv[4];
const outputName = process.argv[5];
if (!candidateName || !stageName || !approvalName || !outputName) throw new Error('PROMOTION_INPUTS_REQUIRED');
const candidate = JSON.parse(readFileSync(candidateName, 'utf8'));
const candidateBytes = readFileSync(candidateName);
const stageBytes = readFileSync(stageName);
const stage = JSON.parse(stageBytes);
const approvalBytes = readFileSync(approvalName);
const approval = JSON.parse(approvalBytes);
const root = resolve(dirname(candidateName));
if (resolve(dirname(outputName)) !== root) throw new Error('PROMOTION_OUTPUT_OUTSIDE_CANDIDATE');
if (candidate.schema !== 'shop.candidate.v1' || stage.schema !== 'shop.stage.v1' || approval.schema !== 'shop.promotion.v1') throw new Error('PROMOTION_SCHEMA_INVALID');
if (candidate.commit !== stage.commit || candidate.commit !== approval.commit) throw new Error('PROMOTION_COMMIT_MISMATCH');
validateStage(stage, candidate, candidateBytes);
if (approval.stageSha256 !== hash(stageBytes)) throw new Error('PROMOTION_EVIDENCE_MISMATCH');
if (!/^[a-z0-9]{8,64}$/.test(approval.releaseId ?? '')) throw new Error('PROMOTION_RELEASE_ID_INVALID');
if (!/^.+@sha256:[0-9a-f]{64}$/.test(approval.image ?? '')) throw new Error('PROMOTION_IMAGE_INVALID');
if (approval.candidateImageSha256 !== candidate.commerce.sha256) throw new Error('PROMOTION_IMAGE_PROVENANCE_INVALID');
if (!/^oss:\/\/[a-z0-9.-]+\/.+/.test(approval.databaseSnapshot ?? '')) throw new Error('PROMOTION_SNAPSHOT_INVALID');
if (!/^oss:\/\/[a-z0-9.-]+\/.+/.test(approval.rollback?.databaseSnapshot ?? '') || !/^[a-z0-9]{8,64}$/.test(approval.rollback?.releaseId ?? '') || !/^[0-9a-f]{64}$/.test(approval.rollback?.pointerSha256 ?? ''))
  throw new Error('PROMOTION_ROLLBACK_INVALID');
if (!/^[0-9a-f]{64}$/.test(approval.approvalSha256 ?? '') || !/^[a-z0-9.-]+$/.test(approval.bucket ?? '')) throw new Error('PROMOTION_AUTHORITY_INVALID');

const release = Object.freeze({
  schema: 'shop.release.v1',
  releaseId: approval.releaseId,
  commit: candidate.commit,
  schemaHead: candidate.schemaHead,
  contractHash: candidate.contractHash,
  facts: candidate.facts,
  commerce: Object.freeze({ image: approval.image, artifactSha256: candidate.commerce.sha256 }),
  clients: candidate.clients,
  sbom: candidate.sbom,
  buildProvenance: candidate.provenance,
  provenance: Object.freeze({ path: 'stage.json', sha256: hash(stageBytes) }),
  static: Object.freeze({ bucket: approval.bucket }),
  evidence: Object.freeze({
    databaseSnapshot: approval.databaseSnapshot,
    releaseApproval: hash(approvalBytes),
    providerSandboxAccepted: true,
    stagePassed: true,
  }),
  rollback: approval.rollback,
});
writeFileSync(outputName, `${JSON.stringify(release, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
writeFileSync(join(root, 'current.json'), `${JSON.stringify({ schema: 'shop.pointer.v1', releaseId: release.releaseId, commit: release.commit, clients: release.clients }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(`release promoted: ${release.releaseId}`);

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}
