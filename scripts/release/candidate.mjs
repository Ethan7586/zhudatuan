import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { REQUIRED_PROVIDER_IDS } from '../../packages/contract/src/provider/ProviderCatalog.ts';
import { TARGET_SCHEMA_HEAD } from '@shop/config/server';
import { JOB_CATALOG } from '../../services/commerce/src/foundation/application/JobCatalog.ts';
import { productionSources } from '../check/source.mjs';
import { directoryHash, fileHash, hash, manifestHash } from './artifacts.mjs';

const root = resolve(import.meta.dirname, '../..');
const output = process.argv[2] ? resolve(process.argv[2]) : undefined;
const commit = process.argv[3];
const image = process.argv[4];
const ociSource = process.argv[5] ? resolve(process.argv[5]) : undefined;
const sbomSource = process.argv[6] ? resolve(process.argv[6]) : undefined;
const provenanceSource = process.argv[7] ? resolve(process.argv[7]) : undefined;
if (!output || output === root || existsSync(output)) throw new Error('CANDIDATE_OUTPUT_MUST_NOT_EXIST');
if (!/^[0-9a-f]{40}$/.test(commit ?? '')) throw new Error('CANDIDATE_COMMIT_INVALID');
if (!/^oci-layout@sha256:[0-9a-f]{64}$/.test(image ?? '')) throw new Error('CANDIDATE_IMAGE_INVALID');
if (!ociSource || !existsSync(ociSource) || !sbomSource || !existsSync(sbomSource) || !provenanceSource || !existsSync(provenanceSource)) throw new Error('CANDIDATE_EVIDENCE_SOURCE_MISSING');

const sources = Object.freeze({
  auth: 'apps/auth/dist',
  console: 'apps/console/dist',
  storefront: 'apps/storefront/dist',
});
mkdirSync(join(output, 'clients'), { recursive: true });
cpSync(ociSource, join(output, 'commerce.oci.tar'), { errorOnExist: true });
cpSync(sbomSource, join(output, 'sbom.cdx.json'), { errorOnExist: true });
cpSync(provenanceSource, join(output, 'provenance.intoto.jsonl'), { errorOnExist: true });
const clients = {};
for (const [client, source] of Object.entries(sources)) {
  const absolute = join(root, source);
  if (!existsSync(absolute)) throw new Error(`CANDIDATE_CLIENT_MISSING:${client}`);
  const destination = join(output, 'clients', client);
  cpSync(absolute, destination, { recursive: true, dereference: true, errorOnExist: true });
  clients[client] = Object.freeze({ path: `clients/${client}`, sha256: directoryHash(destination) });
}

const contractHash = hash(Buffer.concat([readFileSync(join(root, 'packages/contract/openapi.json')), readFileSync(join(root, 'packages/contract/events.json'))]));
const sourceTreeHash = manifestHash(root, productionSources());
const operationHash = manifestHash(root, [join(root, 'packages/contract/definitions/operations.yml'), join(root, 'packages/contract/openapi.json')]);
const eventHash = manifestHash(root, [join(root, 'packages/contract/definitions/events.yml'), join(root, 'packages/contract/events.json')]);
const jobHash = hash(JSON.stringify(JOB_CATALOG));
const requirementHash = manifestHash(root, [join(root, 'config/requirements.yml'), join(root, 'docs/requirements/mapping.json'), join(root, 'docs/requirements/mvp.yml')]);
const ownershipHash = manifestHash(root, [join(root, 'database/contracts/objects.yml'), ...productionSources().filter((path) => path.endsWith('/Manifest.ts') && path.includes('/services/commerce/src/modules/'))]);
const extensionHash = manifestHash(
  root,
  productionSources().filter((path) => path.includes('/extensions/'))
);
const runtimeConfigHash = manifestHash(root, [join(root, 'config/cache.yml'), join(root, 'config/capacity.yml'), join(root, 'config/telemetry.yml'), join(root, 'packages/config/src/RuntimeCatalog.ts')]);
const migrationHash = fileHash(join(root, 'database/contracts/history.json'));
const sbomHash = fileHash(join(output, 'sbom.cdx.json'));
const provenanceHash = fileHash(join(output, 'provenance.intoto.jsonl'));
const imageHash = fileHash(join(output, 'commerce.oci.tar'));
const candidate = Object.freeze({
  schema: 'shop.candidate.v1',
  commit,
  schemaHead: TARGET_SCHEMA_HEAD,
  contractHash,
  facts: Object.freeze({
    sourceTreeHash,
    contractHash,
    operationHash,
    eventHash,
    jobHash,
    jobCount: JOB_CATALOG.length,
    requirementHash,
    migrationHead: TARGET_SCHEMA_HEAD,
    migrationHash,
    ownershipHash,
    extensionHash,
    runtimeConfigHash,
    imageHash,
    sbomHash,
    provenanceHash,
  }),
  image,
  clients,
  sbom: Object.freeze({ path: 'sbom.cdx.json', sha256: sbomHash }),
  provenance: Object.freeze({ path: 'provenance.intoto.jsonl', sha256: provenanceHash }),
  commerce: Object.freeze({ path: 'commerce.oci.tar', sha256: imageHash }),
  requiredProviders: REQUIRED_PROVIDER_IDS,
});
writeFileSync(join(output, 'candidate.json'), `${JSON.stringify(candidate, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(`candidate created: ${relative(root, output)} clients=${Object.keys(clients).length} providers=${REQUIRED_PROVIDER_IDS.length}`);
