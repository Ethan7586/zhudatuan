import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sha256 = /^[a-f0-9]{64}$/;
const commit = /^[a-f0-9]{40}$/;

export interface RequirementReleaseEvidence {
  readonly schema: 'shop.requirement.release.v1';
  readonly requirement: string;
  readonly commit: string;
  readonly sourceTreeHash: string;
  readonly contractHash: string;
  readonly migrationHead: string;
  readonly artifactDigest: string;
  readonly bundle: Readonly<{
    releaseId: string;
    candidateSha256: string;
    stageSha256: string;
    releaseSha256: string;
  }>;
  readonly schemaEvidence: Readonly<{ head: string; sha256: string }>;
  readonly config: Readonly<{ sha256: string }>;
  readonly tests: Readonly<{ evidenceSha256: string }>;
  readonly metrics: Readonly<{ evidenceSha256: string }>;
  readonly approver: Readonly<{ id: string; evidenceSha256: string }>;
  readonly signedAt: string;
  readonly signature: Readonly<{ method: 'sigstore-keyless'; bundleSha256: string }>;
  readonly providers?: readonly string[];
}

export async function readRequirementReleaseEvidence(root: string, path: string, requirement: string): Promise<RequirementReleaseEvidence | null> {
  const value = await readFile(resolve(root, path), 'utf8')
    .then(JSON.parse)
    .catch(() => null);
  return isRequirementReleaseEvidence(value, requirement) ? value : null;
}

export function isRequirementReleaseEvidence(value: unknown, requirement: string): value is RequirementReleaseEvidence {
  if (!record(value)) return false;
  const bundle = value.bundle;
  const schema = value.schemaEvidence;
  const configuration = value.config;
  const tests = value.tests;
  const metrics = value.metrics;
  const approver = value.approver;
  const signature = value.signature;
  return (
    value.schema === 'shop.requirement.release.v1' &&
    value.requirement === requirement &&
    typeof value.commit === 'string' &&
    commit.test(value.commit) &&
    hashes(value, ['sourceTreeHash', 'contractHash', 'artifactDigest']) &&
    typeof value.migrationHead === 'string' &&
    value.migrationHead.length > 0 &&
    record(bundle) &&
    typeof bundle.releaseId === 'string' &&
    bundle.releaseId.length > 0 &&
    hashes(bundle, ['candidateSha256', 'stageSha256', 'releaseSha256']) &&
    record(schema) &&
    schema.head === value.migrationHead &&
    hashes(schema, ['sha256']) &&
    record(configuration) &&
    hashes(configuration, ['sha256']) &&
    record(tests) &&
    hashes(tests, ['evidenceSha256']) &&
    record(metrics) &&
    hashes(metrics, ['evidenceSha256']) &&
    record(approver) &&
    typeof approver.id === 'string' &&
    approver.id.length > 0 &&
    hashes(approver, ['evidenceSha256']) &&
    typeof value.signedAt === 'string' &&
    Number.isSafeInteger(Date.parse(value.signedAt)) &&
    record(signature) &&
    signature.method === 'sigstore-keyless' &&
    hashes(signature, ['bundleSha256'])
  );
}

function hashes(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((field) => typeof value[field] === 'string' && sha256.test(value[field]));
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
