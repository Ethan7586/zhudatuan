import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { loadRequirementSource } from './RequirementSource';
import { readRequirementReleaseEvidence, type RequirementReleaseEvidence } from './ReleaseEvidence';

const root = resolve(import.meta.dirname, '../../..');
const check = process.argv.includes('--check');
const source = await loadRequirementSource(root);
const blocking = source.mvp.filter(({ release }) => release === 'blocking');
const released: string[] = [];
for (const requirement of blocking) {
  const path = resolve(root, 'evidence/releases', `${requirement.id}.json`);
  const evidence = await readRequirementReleaseEvidence(root, path, requirement.id);
  if (evidence) released.push(requirement.id);
}
const blockers: string[] = [];
if (released.length !== blocking.length) blockers.push('SIGNED_RELEASE_EVIDENCE_REQUIRED');
const providerEvidence = await readRequirementReleaseEvidence(root, 'evidence/releases/MVPPROVIDER.json', 'MVPPROVIDER');
const providerReleased = signedProviders(providerEvidence);
const output = `${JSON.stringify(
  {
    schema: 'zhudatuan.releaseeligibility.v3',
    derived: true,
    releaseEligible: released.length === blocking.length && blockers.length === 0 && providerReleased === 11,
    requirements: { released: released.length, blocking: blocking.length },
    providers: { released: providerReleased, required: 11 },
    blockers: [...new Set(blockers)].sort(),
  },
  null,
  2
)}\n`;
const path = resolve(root, 'evidence/releases/index.json');
if (check) {
  if ((await readFile(path, 'utf8').catch(() => '')) !== output) throw new Error('GENERATED_RELEASE_INDEX_DRIFT');
} else {
  await writeFile(path, output, 'utf8');
}

function signedProviders(value: RequirementReleaseEvidence | null): number {
  return value?.providers ? new Set(value.providers).size : 0;
}
