import { IDENTITY_NODE_MANIFEST } from '@shop/config/identity-node-manifest';
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

export function expectedIdentityNodeDatabaseManifest(): IdentityNodeDatabaseManifest {
  const realms = IDENTITY_NODE_MANIFEST.nodes.map((node) => ({
    id: node.realmId,
    node_id: node.nodeId,
    status: node.status,
    node_profile: node.nodeProfile,
    mall_id: node.mallId,
    host_node_id: node.hostNodeId,
    host_node_profile: node.nodeProfile === 'consumer' ? 'operating_mall' : null,
  })).sort(by('id'));
  const entries = IDENTITY_NODE_MANIFEST.nodes.flatMap((node) => node.entries.map((entry) => ({
    host: entry.host,
    realm_id: node.realmId,
    kind: entry.kind,
    status: entry.status,
  }))).sort(by('host'));
  const targets = IDENTITY_NODE_MANIFEST.nodes.flatMap((node) => node.targets.map((target) => ({
    realm_id: node.realmId,
    surface: target.surface,
    target: target.target,
    membership_client: target.membershipClient,
    membership_organization_id: target.membershipOrganizationId,
    application_slug: target.application,
    return_origin: target.returnOrigin,
    node_profile: node.nodeProfile,
  }))).sort((left, right) => `${left.realm_id}:${left.target}`.localeCompare(`${right.realm_id}:${right.target}`));
  return Object.freeze({ realms: Object.freeze(realms), entries: Object.freeze(entries), targets: Object.freeze(targets) });
}

export async function assertIdentityNodeManifestRuntime(pool: DatabasePool): Promise<void> {
  const [realmResult, entryResult, targetResult] = await Promise.all([
    pool.query<RealmRow>(`select id,node_id,status,node_profile,mall_id,host_node_id,host_node_profile
      from identity.realm order by id`),
    pool.query<EntryRow>(`select host,realm_id,kind,status from identity.realmentry order by host`),
    pool.query<TargetRow>(`select realm_id,surface,target,membership_client,membership_organization_id,
      application_slug,return_origin,node_profile from identity.realmtarget order by realm_id,target`),
  ]);
  const expected = expectedIdentityNodeDatabaseManifest();
  const actual = {
    realms: realmResult.rows.map((row) => ({ ...row })),
    entries: entryResult.rows.map((row) => ({ ...row })),
    targets: targetResult.rows.map((row) => ({ ...row })),
  };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`IDENTITY_NODE_MANIFEST_RUNTIME_DRIFT:${IDENTITY_NODE_MANIFEST.revision}`);
  }
}

function by<Key extends string>(key: Key): (left: Record<Key, string>, right: Record<Key, string>) => number {
  return (left, right) => left[key].localeCompare(right[key]);
}
