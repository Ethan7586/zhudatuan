import { describe, expect, it } from 'vitest';
import { PRODUCTION_IDENTITY_NODE_REGISTRY } from '@shop/sdk/identity-node';
import type { DatabasePool } from '../foundation/persistence/Pool';
import { SERVER_NODE_MANIFEST_REGISTRY } from './ApiBootstrap';
import {
  assertIdentityNodeManifestRuntime,
  expectedIdentityNodeDatabaseManifest,
  type IdentityNodeDatabaseManifest,
} from './IdentityNodeManifestRuntime';

describe('identity node manifest runtime parity', () => {
  it('accepts only the database registry projected from the canonical manifest', async () => {
    const expected = expectedIdentityNodeDatabaseManifest();
    await expect(assertIdentityNodeManifestRuntime(pool(expected))).resolves.toBeUndefined();
    await expect(assertIdentityNodeManifestRuntime(pool({
      ...expected,
      targets: expected.targets.map((target, index) => index === 0
        ? { ...target, membership_client: `${target.membership_client}-drifted` }
        : target),
    }))).rejects.toThrow('IDENTITY_NODE_MANIFEST_RUNTIME_DRIFT');
  });

  it('checks only the generated runtime node when another provisioned node exists', async () => {
    const manifest = SERVER_NODE_MANIFEST_REGISTRY.manifests[1]!;
    const node = PRODUCTION_IDENTITY_NODE_REGISTRY.nodes.find((candidate) => candidate.nodeId === manifest.node_id)!;
    const expected = expectedIdentityNodeDatabaseManifest(manifest, node);
    const realmId = 'realm:provisioned:future';
    const statements: string[] = [];
    const database = pool({
      realms: [...expected.realms, {
        id: realmId,
        node_id: 'node:provisioned:future',
        status: 'active',
        node_profile: 'operating_mall',
        mall_id: 'mall:provisioned:future',
        host_node_id: null,
        host_node_profile: null,
      }],
      entries: [...expected.entries, { host: 'accounts.future.invalid', realm_id: realmId, kind: 'accounts', status: 'active' }],
      targets: [...expected.targets, {
        realm_id: realmId,
        surface: 'consumer',
        target: 'storefront-future',
        membership_client: 'storefront',
        membership_organization_id: 'mall:provisioned:future',
        application_slug: null,
        return_origin: 'https://future.invalid',
        node_profile: 'operating_mall',
      }],
    }, statements);
    await expect(assertIdentityNodeManifestRuntime(database, manifest, node)).resolves.toBeUndefined();
    expect(statements).toHaveLength(3);
    expect(statements.every((statement) => statement.includes('where') && statement.includes('$1'))).toBe(true);
  });

  it('retains every L0 admin target while validating only the L0 realm', () => {
    const manifest = SERVER_NODE_MANIFEST_REGISTRY.manifests.find((candidate) => candidate.node_id === 'node:zhudatuan:l0')!;
    const node = PRODUCTION_IDENTITY_NODE_REGISTRY.nodes.find((candidate) => candidate.nodeId === manifest.node_id)!;
    const expected = expectedIdentityNodeDatabaseManifest(manifest, node);
    expect(expected.targets.map((target) => target.target)).toEqual(['console', 'store', 'storefront', 'supplier']);
    expect(new Set(expected.targets.map((target) => target.realm_id))).toEqual(new Set(['realm:l0']));
  });
});

function pool(manifest: IdentityNodeDatabaseManifest, statements: string[] = []): DatabasePool {
  return {
    query: async (statement: string, parameters?: readonly unknown[]) => {
      statements.push(statement);
      if (statement.includes('from identity.realmentry')) {
        const rows = parameters === undefined ? manifest.entries : manifest.entries.filter((row) => row.realm_id === parameters[0]);
        return result(rows);
      }
      if (statement.includes('from identity.realmtarget')) {
        const rows = parameters === undefined ? manifest.targets : manifest.targets.filter((row) => row.realm_id === parameters[0]);
        return result(rows);
      }
      if (statement.includes('from identity.realm')) {
        const rows = parameters === undefined ? manifest.realms : manifest.realms.filter((row) => row.id === parameters[0]);
        return result(rows);
      }
      throw new Error(`UNEXPECTED_QUERY:${statement}`);
    },
  } as unknown as DatabasePool;
}

function result(rows: readonly unknown[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
