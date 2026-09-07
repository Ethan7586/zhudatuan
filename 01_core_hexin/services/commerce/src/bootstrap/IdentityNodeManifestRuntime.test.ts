import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
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
      targets: expected.targets.map((target) => target.target === 'console-hbbtzn'
        ? { ...target, membership_client: 'storefront' }
        : target),
    }))).rejects.toThrow('IDENTITY_NODE_MANIFEST_RUNTIME_DRIFT');
  });
});

function pool(manifest: IdentityNodeDatabaseManifest): DatabasePool {
  return {
    query: async (statement: string) => {
      if (statement.includes('from identity.realm order by id')) return result(manifest.realms);
      if (statement.includes('from identity.realmentry order by host')) return result(manifest.entries);
      if (statement.includes('from identity.realmtarget order by realm_id,target')) return result(manifest.targets);
      throw new Error(`UNEXPECTED_QUERY:${statement}`);
    },
  } as unknown as DatabasePool;
}

function result(rows: readonly unknown[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
