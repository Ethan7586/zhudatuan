import { readFile } from 'node:fs/promises';
import { IDENTITY_NODE_MANIFEST } from '@shop/config/identity-node-manifest';
import type { NodeManifest } from '@shop/config/sfl-node-kernel';
import {
  PRODUCTION_IDENTITY_NODE_REGISTRY,
  parseIdentityNodeRegistry,
  type IdentityNodeDefinition,
} from '@shop/sdk/identity-node';
import type { DatabasePool } from '../foundation/persistence/Pool';

interface RealmRow {
  readonly id: string;
  readonly node_id: string;
  readonly status: string;
  readonly node_profile: string;
  readonly mall_id: string | null;
  readonly host_node_id: string | null;
  readonly host_node_profile: string | null;
}

interface EntryRow {
  readonly host: string;
  readonly realm_id: string;
  readonly kind: string;
  readonly status: string;
}

interface TargetRow {
  readonly realm_id: string;
  readonly surface: string;
  readonly target: string;
  readonly membership_client: string;
  readonly membership_organization_id: string;
  readonly application_slug: string | null;
  readonly return_origin: string;
  readonly node_profile: string;
}

export interface IdentityNodeDatabaseManifest {
  readonly realms: readonly RealmRow[];
  readonly entries: readonly EntryRow[];
  readonly targets: readonly TargetRow[];
}

export async function loadIdentityNodeRuntimeDefinition(
  path: string | undefined,
  manifest: NodeManifest,
): Promise<IdentityNodeDefinition> {
  let nodes: readonly IdentityNodeDefinition[];
  if (path?.trim()) {
    const runtime = JSON.parse(await readFile(path, 'utf8')) as unknown;
    if (!isRecord(runtime) || runtime.schema_version !== 'sfl.identity-node-runtime.v1') {
      throw new Error('IDENTITY_NODE_RUNTIME_INVALID');
    }
    nodes = parseIdentityNodeRegistry(JSON.stringify(runtime.identity_node_registry)).nodes;
  } else {
    nodes = PRODUCTION_IDENTITY_NODE_REGISTRY.nodes;
  }
  const matches = nodes.filter((node) => node.nodeId === manifest.node_id);
  if (matches.length !== 1) throw new Error(`IDENTITY_NODE_RUNTIME_NODE_UNKNOWN:${manifest.node_id}`);
  assertRuntimeIdentityMatchesManifest(manifest, matches[0]!);
  return matches[0]!;
}

export function expectedIdentityNodeDatabaseManifest(
  manifest?: NodeManifest,
  node?: IdentityNodeDefinition,
): IdentityNodeDatabaseManifest {
  if (manifest !== undefined || node !== undefined) {
    if (manifest === undefined || node === undefined) throw new Error('IDENTITY_NODE_RUNTIME_ARGUMENTS_INCOMPLETE');
    assertRuntimeIdentityMatchesManifest(manifest, node);
    const realmId = manifest.realm_ref.ref;
    const status = manifest.lifecycle_status === 'active' ? 'active' : 'disabled';
    const realms = [{
      id: realmId,
      node_id: manifest.node_id,
      status,
      node_profile: node.nodeProfile,
      mall_id: node.mallId,
      host_node_id: node.hostNodeId,
      host_node_profile: node.nodeProfile === 'consumer' ? 'operating_mall' : null,
    }];
    const entries = [
      { host: node.accountsHost, realm_id: realmId, kind: 'accounts', status },
      { host: new URL(node.apiOrigin).hostname, realm_id: realmId, kind: 'api', status },
      ...node.storefrontHosts.slice(0, 1).map((host) => ({ host, realm_id: realmId, kind: 'storefront', status })),
    ].sort(by('host'));
    const targets = [
      ...(node.nodeProfile === 'operating_mall' ? [{
        realm_id: realmId,
        surface: 'admin',
        target: node.adminTarget,
        membership_client: 'operator',
        membership_organization_id: node.mallId,
        application_slug: null,
        return_origin: node.adminOrigin,
        node_profile: node.nodeProfile,
      }] : []),
      {
        realm_id: realmId,
        surface: 'consumer',
        target: node.consumerTarget,
        membership_client: 'storefront',
        membership_organization_id: node.nodeProfile === 'operating_mall' ? node.mallId : node.hostNodeId,
        application_slug: node.consumerApplication,
        return_origin: node.storefrontOrigin,
        node_profile: node.nodeProfile,
      },
    ].sort((left, right) => `${left.realm_id}:${left.target}`.localeCompare(`${right.realm_id}:${right.target}`));
    return Object.freeze({ realms: Object.freeze(realms), entries: Object.freeze(entries), targets: Object.freeze(targets) });
  }

  const realms = IDENTITY_NODE_MANIFEST.nodes.map((candidate) => ({
    id: candidate.realmId,
    node_id: candidate.nodeId,
    status: candidate.status,
    node_profile: candidate.nodeProfile,
    mall_id: candidate.mallId,
    host_node_id: candidate.hostNodeId,
    host_node_profile: candidate.nodeProfile === 'consumer' ? 'operating_mall' : null,
  })).sort(by('id'));
  const entries = IDENTITY_NODE_MANIFEST.nodes.flatMap((candidate) => candidate.entries.map((entry) => ({
    host: entry.host,
    realm_id: candidate.realmId,
    kind: entry.kind,
    status: entry.status,
  }))).sort(by('host'));
  const targets = IDENTITY_NODE_MANIFEST.nodes.flatMap((candidate) => candidate.targets.map((target) => ({
    realm_id: candidate.realmId,
    surface: target.surface,
    target: target.target,
    membership_client: target.membershipClient,
    membership_organization_id: target.membershipOrganizationId,
    application_slug: target.application,
    return_origin: target.returnOrigin,
    node_profile: candidate.nodeProfile,
  }))).sort((left, right) => `${left.realm_id}:${left.target}`.localeCompare(`${right.realm_id}:${right.target}`));
  return Object.freeze({ realms: Object.freeze(realms), entries: Object.freeze(entries), targets: Object.freeze(targets) });
}

export async function assertIdentityNodeManifestRuntime(
  pool: DatabasePool,
  manifest?: NodeManifest,
  node?: IdentityNodeDefinition,
): Promise<void> {
  const expected = expectedIdentityNodeDatabaseManifest(manifest, node);
  const scoped = manifest !== undefined;
  const realmId = manifest?.realm_ref.ref;
  const [realmResult, entryResult, targetResult] = await Promise.all([
    pool.query<RealmRow>(`select id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile
      from identity.realm${scoped ? ' where id=$1' : ''} order by id`, scoped ? [realmId] : undefined),
    pool.query<EntryRow>(`select host,realm_id,kind,status from identity.realmentry${scoped ? ' where realm_id=$1' : ''} order by host`,
      scoped ? [realmId] : undefined),
    pool.query<TargetRow>(`select realm_id,surface,target,membership_client,membership_organization_id,
      application_slug,return_origin,node_profile from identity.realmtarget${scoped ? ' where realm_id=$1' : ''} order by realm_id,target`,
      scoped ? [realmId] : undefined),
  ]);
  const actual = {
    realms: realmResult.rows.map((row) => ({ ...row })),
    entries: entryResult.rows.map((row) => ({ ...row })),
    targets: targetResult.rows.map((row) => ({ ...row })),
  };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`IDENTITY_NODE_MANIFEST_RUNTIME_DRIFT:${manifest?.manifest_id ?? IDENTITY_NODE_MANIFEST.revision}`);
  }
}

function assertRuntimeIdentityMatchesManifest(manifest: NodeManifest, node: IdentityNodeDefinition): void {
  const hosts = (surface: string) => manifest.domain_bindings
    .filter((binding) => binding.surface_ref === `surface:${surface}`)
    .map((binding) => binding.host).sort();
  if (node.nodeId !== manifest.node_id || node.nodeProfile !== manifest.node_profile
    || node.mallId !== manifest.mall_id || node.hostNodeId !== manifest.host_node_id
    || node.accountsHost !== hosts('identity')[0]
    || new URL(node.apiOrigin).hostname !== hosts('api')[0]
    || (node.adminOrigin === null ? null : new URL(node.adminOrigin).hostname) !== (hosts('console')[0] ?? null)
    || [...node.storefrontHosts].sort().join(',') !== hosts('storefront').join(',')) {
    throw new Error(`IDENTITY_NODE_RUNTIME_MANIFEST_MISMATCH:${manifest.node_id}`);
  }
}

function by<Key extends string>(key: Key): (left: Record<Key, string>, right: Record<Key, string>) => number {
  return (left, right) => left[key].localeCompare(right[key]);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
