import { readFileSync } from 'node:fs';
import { TARGET_SCHEMA_HEAD } from '@shop/config/server';

const source = process.argv[2];
if (!source) throw new Error('RELEASE_MANIFEST_REQUIRED');
const value = JSON.parse(readFileSync(source, 'utf8'));
const requiredClients = ['auth', 'console', 'storefront'];
const requiredFacts = ['sourceTreeHash', 'contractHash', 'operationHash', 'eventHash', 'jobHash', 'requirementHash', 'migrationHash', 'ownershipHash', 'extensionHash', 'runtimeConfigHash', 'imageHash', 'sbomHash', 'provenanceHash'];
const digest = /^.+@sha256:[0-9a-f]{64}$/;
const sha = /^[0-9a-f]{64}$/;

if (value.schema !== 'shop.release.v1') throw new Error('RELEASE_SCHEMA_INVALID');
if (!/^[a-z0-9]{8,64}$/.test(value.releaseId)) throw new Error('RELEASE_ID_INVALID');
if (!/^[0-9a-f]{40}$/.test(value.commit)) throw new Error('RELEASE_COMMIT_INVALID');
if (value.schemaHead !== TARGET_SCHEMA_HEAD) throw new Error('RELEASE_SCHEMA_HEAD_INVALID');
if (!sha.test(value.contractHash) || !digest.test(value.commerce?.image ?? '') || !sha.test(value.commerce?.artifactSha256 ?? '')) throw new Error('RELEASE_RUNTIME_IDENTITY_INVALID');
if (value.facts?.jobCount !== 33 || value.facts?.migrationHead !== TARGET_SCHEMA_HEAD) throw new Error('RELEASE_FACT_CATALOG_INVALID');
for (const fact of requiredFacts) if (!sha.test(value.facts?.[fact] ?? '')) throw new Error(`RELEASE_FACT_INVALID:${fact}`);
if (value.facts.contractHash !== value.contractHash || value.facts.imageHash !== value.commerce.artifactSha256 || value.facts.sbomHash !== value.sbom?.sha256 || value.facts.provenanceHash !== value.buildProvenance?.sha256)
  throw new Error('RELEASE_FACT_BINDING_INVALID');
if (
  value.sbom?.path !== 'sbom.cdx.json' ||
  !sha.test(value.sbom?.sha256 ?? '') ||
  value.buildProvenance?.path !== 'provenance.intoto.jsonl' ||
  !sha.test(value.buildProvenance?.sha256 ?? '') ||
  value.provenance?.path !== 'stage.json' ||
  !sha.test(value.provenance?.sha256 ?? '')
)
  throw new Error('RELEASE_SUPPLY_CHAIN_EVIDENCE_INVALID');
if (
  Object.keys(value.clients ?? {})
    .sort()
    .join(',') !== requiredClients.join(',')
)
  throw new Error('RELEASE_CLIENT_SET_INVALID');
for (const client of requiredClients) {
  const artifact = value.clients[client];
  if (artifact.path !== `clients/${client}` || !sha.test(artifact.sha256 ?? '')) throw new Error(`RELEASE_CLIENT_INVALID:${client}`);
}
if (!/^oss:\/\/[a-z0-9.-]+\/.+/.test(value.evidence?.databaseSnapshot ?? '')) throw new Error('RELEASE_SNAPSHOT_EVIDENCE_INVALID');
if (!sha.test(value.evidence?.releaseApproval ?? '')) throw new Error('RELEASE_APPROVAL_INVALID');
if (!/^[a-z0-9.-]+$/.test(value.static?.bucket ?? '')) throw new Error('RELEASE_STATIC_BUCKET_INVALID');
if (value.evidence?.providerSandboxAccepted !== true || value.evidence?.stagePassed !== true) throw new Error('RELEASE_STAGE_EVIDENCE_INVALID');
if (!/^[a-z0-9]{8,64}$/.test(value.rollback?.releaseId ?? '') || !/^oss:\/\/[a-z0-9.-]+\/.+/.test(value.rollback?.databaseSnapshot ?? '') || !sha.test(value.rollback?.pointerSha256 ?? ''))
  throw new Error('RELEASE_ROLLBACK_EVIDENCE_INVALID');
console.log(`release manifest valid: ${value.releaseId}`);
