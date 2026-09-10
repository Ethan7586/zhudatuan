import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { processEnvironment, providerCatalogEnvironment } from '@shop/config/server';
import { manifestPayload, REQUIRED_PROVIDER_IDS, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';
import { withMigrationOwnership } from '../platform/database/MigrationOwnership';
import type { Client } from 'pg';

import { WorkloadSecretStore, secretText } from '../platform/secret/SecretStore';
import { Manifest } from '../modules/extension/domain/model/Manifest';
import { PROVIDER_FACTORIES } from '../modules/extension/infrastructure/loader/ProviderCatalog';

export interface ProviderRegistration {
  readonly contractHash: string;
  readonly manifest: ProviderManifest;
  readonly manifestHash: string;
}

export function signProviderCatalog(privateKey: KeyObject, publicKey: KeyObject): readonly ProviderRegistration[] {
  const definitions = new Map(PROVIDER_FACTORIES.map((factory) => [factory.id, factory.definition]));
  if (definitions.size !== REQUIRED_PROVIDER_IDS.length || REQUIRED_PROVIDER_IDS.some((id) => !definitions.has(id))) {
    throw new Error('PROVIDER_CATALOG_INCOMPLETE');
  }
  return Object.freeze(REQUIRED_PROVIDER_IDS.map((id) => signProvider(definitions.get(id)!, privateKey, publicKey)));
}

export function signProvider(definition: UnsignedProviderManifest, privateKey: KeyObject, publicKey: KeyObject): ProviderRegistration {
  const unsigned = { ...definition, signature: '' } satisfies ProviderManifest;
  const payload = manifestPayload(unsigned);
  const signature = sign(null, Buffer.from(payload), privateKey).toString('base64');
  if (!verify(null, Buffer.from(payload), publicKey, Buffer.from(signature, 'base64'))) throw new Error('PROVIDER_MANIFEST_KEYPAIR_INVALID');
  const manifest = Manifest.parse({ ...definition, signature }, definition.id);
  const contractHash = createHash('sha256')
    .update(JSON.stringify({ version: definition.contractVersion, capabilities: [...definition.capabilities].sort() }))
    .digest('hex');
  return Object.freeze({ contractHash, manifest: manifest.value, manifestHash: manifest.hash });
}

export async function registerProviderCatalog(connectionString: string, registrations: readonly ProviderRegistration[]): Promise<void> {
  await withMigrationOwnership(connectionString, async (client) => {
    for (const registration of registrations) await register(client, registration);
  });
}

async function register(client: Client, registration: ProviderRegistration): Promise<void> {
  const manifest = registration.manifest;
  await client.query(
    `insert into extension.contractversion(extension_id,contract_version,schema_hash,sandbox_evidence_ref,status)
    values($1,$2,$3,$4,'verified') on conflict(extension_id,contract_version) do update
    set schema_hash=excluded.schema_hash,sandbox_evidence_ref=excluded.sandbox_evidence_ref,status='verified'`,
    [manifest.id, manifest.contractVersion, registration.contractHash, `release:${manifest.version}`]
  );
  const contract = await client.query<{ schema_hash: string; status: string }>(`select schema_hash,status from extension.contractversion where extension_id=$1 and contract_version=$2`, [manifest.id, manifest.contractVersion]);
  if (contract.rows.length !== 1 || contract.rows[0]?.schema_hash.trim() !== registration.contractHash || contract.rows[0]?.status !== 'verified') {
    throw new Error(`PROVIDER_CONTRACT_REGISTRATION_CONFLICT:${manifest.id}`);
  }

  await client.query(
    `insert into extension.manifest(id,version,kind,contract_version,manifest,manifest_hash,signature,registered_at)
    values($1,$2,$3,$4,$5::jsonb,$6,$7,clock_timestamp()) on conflict(id,version) do update
    set kind=excluded.kind,contract_version=excluded.contract_version,manifest=excluded.manifest,
      manifest_hash=excluded.manifest_hash,signature=excluded.signature,registered_at=excluded.registered_at`,
    [manifest.id, manifest.version, manifest.kind, manifest.contractVersion, JSON.stringify(manifest), registration.manifestHash, manifest.signature]
  );
  const stored = await client.query<{
    contract_version: string;
    kind: string;
    manifest: unknown;
    manifest_hash: string;
    signature: string;
  }>(`select kind,contract_version,manifest,manifest_hash,signature from extension.manifest where id=$1 and version=$2`, [manifest.id, manifest.version]);
  const record = stored.rows[0];
  if (
    stored.rows.length !== 1 ||
    record?.kind !== manifest.kind ||
    record.contract_version !== manifest.contractVersion ||
    record.manifest_hash.trim() !== registration.manifestHash ||
    record.signature !== manifest.signature ||
    manifestPayload(Manifest.parse(record.manifest, manifest.id).value) !== manifestPayload(manifest)
  ) {
    throw new Error(`PROVIDER_MANIFEST_REGISTRATION_CONFLICT:${manifest.id}`);
  }

  const installations = await client.query<{ id: string; status: string }>(
    `update extension.installation set manifest=$3::jsonb,version=version+1
    where extension_id=$1 and extension_version=$2 and manifest is distinct from $3::jsonb
    returning id,status`,
    [manifest.id, manifest.version, JSON.stringify(manifest)]
  );
  for (const installation of installations.rows) {
    await client.query(
      `insert into extension.activationhistory(installation_id,sequence,previous_state,next_state,actor_id,evidence,occurred_at)
      select $1,coalesce(max(sequence),0)+1,$2,$2,'release:providercatalog',
        jsonb_build_object('reason','signed manifest synchronized','manifestHash',$3::text),clock_timestamp()
      from extension.activationhistory where installation_id=$1`,
      [installation.id, installation.status, registration.manifestHash]
    );
  }
}

async function main(): Promise<void> {
  const environment = providerCatalogEnvironment(processEnvironment());
  const [privateKeySource, publicKeySource] = await Promise.all([readFile(environment.manifestPrivateKeyFile), readFile(environment.manifestPublicKeyFile)]);
  const registrations = signProviderCatalog(createPrivateKey(privateKeySource), createPublicKey(publicKeySource));
  const secrets = new WorkloadSecretStore(environment.secretStoreEndpoint, environment.secretStoreBearerToken);
  const connection = await secretText(secrets, environment.databaseConnectionRef, 'database');
  await registerProviderCatalog(connection, registrations);
  process.stdout.write(`PROVIDER_CATALOG_REGISTERED providers=${registrations.length}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
