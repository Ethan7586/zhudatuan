import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { miniappArtifactHash, validateDeviceEvidence } from './DeviceEvidence';

const root = resolve(import.meta.dirname, '..');
const artifact = resolve(root, 'dist/miniprogram');
const artifactSha256 = miniappArtifactHash(artifact);
if (process.argv.includes('--hash')) {
  console.log(artifactSha256);
  process.exit(0);
}
const evidencePath = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
if (evidencePath === undefined || !existsSync(resolve(evidencePath))) throw new Error('MINIAPP_DEVICE_EVIDENCE_REQUIRED');
const evidence = validateDeviceEvidence(JSON.parse(readFileSync(resolve(evidencePath), 'utf8')), artifactSha256);
console.log(`miniapp device gate: artifact=${artifactSha256} records=${evidence.records.length} approver=${evidence.approvedBy}`);
