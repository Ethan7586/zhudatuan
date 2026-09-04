import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { directoryHash, fileHash, hash } from './artifacts.mjs';
import { validateStage } from './stage.mjs';

const root = process.argv[2] ? resolve(process.argv[2]) : undefined;
if (!root || root === '/') throw new Error('RELEASE_BUNDLE_ROOT_INVALID');
const release = read('release.json');
const candidateBytes = bytes('candidate.json');
const candidate = JSON.parse(candidateBytes);
const stageBytes = bytes('stage.json');
const stage = JSON.parse(stageBytes);
const approvalBytes = bytes('promotion.json');
const approval = JSON.parse(approvalBytes);
validateStage(stage, candidate, candidateBytes);
if (release.commit !== candidate.commit || release.contractHash !== candidate.contractHash) throw new Error('RELEASE_CANDIDATE_IDENTITY_MISMATCH');
if (release.provenance?.sha256 !== hash(stageBytes) || release.evidence?.releaseApproval !== hash(approvalBytes)) throw new Error('RELEASE_EVIDENCE_HASH_MISMATCH');
if (approval.stageSha256 !== hash(stageBytes) || approval.candidateImageSha256 !== candidate.commerce.sha256) throw new Error('RELEASE_PROMOTION_LINK_MISMATCH');
if (release.commerce?.artifactSha256 !== fileHash(join(root, candidate.commerce.path))) throw new Error('RELEASE_COMMERCE_ARTIFACT_MISMATCH');
if (release.sbom?.sha256 !== fileHash(join(root, release.sbom.path))) throw new Error('RELEASE_SBOM_MISMATCH');
for (const [client, artifact] of Object.entries(release.clients ?? {})) {
  if (artifact.sha256 !== directoryHash(join(root, artifact.path))) throw new Error(`RELEASE_CLIENT_ARTIFACT_MISMATCH:${client}`);
}
const pointer = read('current.json');
if (pointer.schema !== 'shop.pointer.v1' || pointer.releaseId !== release.releaseId || pointer.commit !== release.commit
  || JSON.stringify(pointer.clients) !== JSON.stringify(release.clients)) throw new Error('RELEASE_POINTER_MISMATCH');
console.log(`release bundle valid: ${release.releaseId}`);

function bytes(name) {
  const path = join(root, name);
  if (!existsSync(path)) throw new Error(`RELEASE_BUNDLE_FILE_MISSING:${name}`);
  return readFileSync(path);
}

function read(name) {
  return JSON.parse(bytes(name));
}
