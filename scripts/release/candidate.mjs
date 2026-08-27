import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { REQUIRED_PROVIDER_IDS } from '../../packages/contract/src/provider/ProviderCatalog.ts';
import { TARGET_SCHEMA_HEAD } from '@shop/config/server';
import { directoryHash, fileHash, hash } from './artifacts.mjs';

const root = resolve(import.meta.dirname, '../..');
const output = process.argv[2] ? resolve(process.argv[2]) : undefined;
const commit = process.argv[3];
const image = process.argv[4];
const ociSource = process.argv[5] ? resolve(process.argv[5]) : undefined;
const sbomSource = process.argv[6] ? resolve(process.argv[6]) : undefined;
if (!output || output === root || existsSync(output)) throw new Error('CANDIDATE_OUTPUT_MUST_NOT_EXIST');
if (!/^[0-9a-f]{40}$/.test(commit ?? '')) throw new Error('CANDIDATE_COMMIT_INVALID');
if (!/^oci-layout@sha256:[0-9a-f]{64}$/.test(image ?? '')) throw new Error('CANDIDATE_IMAGE_INVALID');
if (!ociSource || !existsSync(ociSource) || !sbomSource || !existsSync(sbomSource)) throw new Error('CANDIDATE_EVIDENCE_SOURCE_MISSING');

const sources = Object.freeze({
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  auth: 'apps/auth-web/dist',
  console: 'apps/console/dist',
  miniapp: 'apps/miniapp/miniprogram',
  // Store and supplier are role-scoped Console entry points, not separate builds.
  store: 'apps/console/dist',
  storefront: 'apps/storefront-web/dist',
  supplier: 'apps/console/dist',
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  auth: 'apps/auth/dist',
  console: 'apps/console/dist',
  miniapp: 'apps/miniapp/miniprogram',
  store: 'apps/store/dist',
  storefront: 'apps/storefront/dist',
  supplier: 'apps/supplier/dist',
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  auth: 'apps/auth-web/dist',
  console: 'apps/console/dist',
  miniapp: 'apps/miniapp/miniprogram',
  // Store and supplier are role-scoped Console entry points, not separate builds.
  store: 'apps/console/dist',
  storefront: 'apps/storefront-web/dist',
  supplier: 'apps/console/dist',
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
});
mkdirSync(join(output, 'clients'), { recursive: true });
cpSync(ociSource, join(output, 'commerce.oci.tar'), { errorOnExist: true });
cpSync(sbomSource, join(output, 'sbom.cdx.json'), { errorOnExist: true });
const clients = {};
for (const [client, source] of Object.entries(sources)) {
  const absolute = join(root, source);
  if (!existsSync(absolute)) throw new Error(`CANDIDATE_CLIENT_MISSING:${client}`);
  const destination = join(output, 'clients', client);
  cpSync(absolute, destination, { recursive: true, dereference: true, errorOnExist: true });
  clients[client] = Object.freeze({ path: `clients/${client}`, sha256: directoryHash(destination) });
}

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
const contractHash = hash(Buffer.concat([readFileSync(join(root, 'packages/contract/openapi.json')), readFileSync(join(root, 'packages/contract/events.json'))]));
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
const contractHash = hash(Buffer.concat([
  readFileSync(join(root, 'packages/contract/openapi.json')),
  readFileSync(join(root, 'packages/contract/events.json')),
]));
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
const contractHash = hash(Buffer.concat([readFileSync(join(root, 'packages/contract/openapi.json')), readFileSync(join(root, 'packages/contract/events.json'))]));
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
const candidate = Object.freeze({
  schema: 'shop.candidate.v1',
  commit,
  schemaHead: TARGET_SCHEMA_HEAD,
  contractHash,
  image,
  clients,
  sbom: Object.freeze({ path: 'sbom.cdx.json', sha256: fileHash(join(output, 'sbom.cdx.json')) }),
  commerce: Object.freeze({ path: 'commerce.oci.tar', sha256: fileHash(join(output, 'commerce.oci.tar')) }),
  requiredProviders: REQUIRED_PROVIDER_IDS,
});
writeFileSync(join(output, 'candidate.json'), `${JSON.stringify(candidate, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(`candidate created: ${relative(root, output)} clients=${Object.keys(clients).length} providers=${REQUIRED_PROVIDER_IDS.length}`);
