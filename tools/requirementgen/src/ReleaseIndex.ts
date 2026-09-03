import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { loadRequirementSource } from './RequirementSource';

const root = resolve(import.meta.dirname, '../../..');
const check = process.argv.includes('--check');
const source = await loadRequirementSource(root);
const required = source.mvp.filter(({ release }) => release === 'required');
const nonblocking = source.mvp.filter(({ release }) => release === 'nonblocking');
const released: string[] = [];
for (const requirement of required) {
  const path = resolve(root, 'evidence/releases', `${requirement.id}.json`);
  const evidence = await readFile(path, 'utf8').then(JSON.parse).catch(() => null);
  if (signedEvidence(evidence, requirement.id)) released.push(requirement.id);
}
const blockers = source.clarifications
  .filter(({ blocking, status }) => blocking && status === 'open')
  .flatMap(({ id, requirements }) => requirements.map((requirement) => `${requirement}:${id}`));
if (released.length !== required.length) blockers.push('SIGNED_RELEASE_EVIDENCE_REQUIRED');
const providerEvidence = await readFile(resolve(root, 'evidence/releases/MVPPROVIDER.json'), 'utf8').then(JSON.parse).catch(() => null);
const providerReleased = signedProviders(providerEvidence);
const output = `${JSON.stringify(
  {
    schema: 'zhudatuan.releaseeligibility.v2',
    derived: true,
    releaseEligible: released.length === required.length && blockers.length === 0 && providerReleased === 11,
    requirements: { released: released.length, required: required.length, nonblocking: nonblocking.length },
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

function signedEvidence(value: unknown, requirement: string): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.requirement === requirement && typeof record.buildSha === 'string' && /^[a-f0-9]{40}$/.test(record.buildSha) && typeof record.signedAt === 'string' && !Number.isNaN(Date.parse(record.signedAt)) && typeof record.signature === 'string' && record.signature.length >= 32;
}

function signedProviders(value: unknown): number {
  if (!signedEvidence(value, 'MVPPROVIDER') || value === null || typeof value !== 'object' || Array.isArray(value)) return 0;
  const providers = (value as Record<string, unknown>).providers;
  return Array.isArray(providers) ? new Set(providers.filter((provider): provider is string => typeof provider === 'string')).size : 0;
}
