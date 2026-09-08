import { describe, expect, it } from 'vitest';
import type { AccessContext } from '../../../platform/security/AccessContext';
import { NAVIGATION_CATALOG } from '../infrastructure/registry/NavigationCatalog';
import { NavigationProjector } from '../application/service/NavigationProjector';
import { result, withReadTransaction } from '../../../test/TransactionFixture';

describe('NavigationProjector', () => {
  it('reads each bounded context once and produces a filtered immutable tree', async () => {
    const calls = { identity: 0, access: 0, organization: 0, capability: 0 };
    const permissions = new Set(NAVIGATION_CATALOG.flatMap((node) => (node.permission === null ? [] : [node.permission])));
    const capabilities = new Set(NAVIGATION_CATALOG.map((node) => node.capability));
    const projector = new NavigationProjector(
      {
        read: async () => {
          calls.identity += 1;
          return { principal: 'principal:1', membership: 'membership:1', membershipStatus: 'active', accessVersion: 7, assurance: 2 };
        },
      },
      {
        read: async () => {
          calls.access += 1;
          return [{ membership: 'membership:1', permissions, version: 7 }];
        },
      },
      {
        read: async () => {
          calls.organization += 1;
          return [{ membership: 'membership:1', id: 'enterprise:1', kind: 'enterprise', status: 'active', version: 3, default: true }];
        },
      },
      {
        read: async () => {
          calls.capability += 1;
          return [{ scope: 'enterprise:1', capabilities, version: 11 }];
        },
      },
      { now: () => new Date('2026-08-29T00:00:00.000Z') },
      's'.repeat(32),
      NAVIGATION_CATALOG,
      'catalog'
    );
    const projection = await withReadTransaction(
      async () => result([]),
      (context) => projector.project(context, accessContext(), 'enterprise:1')
    );
    expect(calls).toEqual({ identity: 1, access: 1, organization: 1, capability: 1 });
    expect(projection.tree.nodes.length).toBeGreaterThan(0);
    expect(projection.tree.scope).toEqual({ id: 'enterprise:1', kind: 'enterprise' });
    expect(Object.isFrozen(projection.tree)).toBe(true);
    expect(projection.key.cache).toMatch(/^navigation:v2:[a-f0-9]{64}$/);
    expect(JSON.stringify(projection.tree)).not.toContain('permissions');
  });

  it('rejects a stale access version before returning any nodes', async () => {
    const projector = new NavigationProjector(
      { read: async () => ({ principal: 'principal:1', membership: 'membership:1', membershipStatus: 'active', accessVersion: 6, assurance: 2 }) },
      { read: async () => [{ membership: 'membership:1', permissions: new Set(), version: 6 }] },
      { read: async () => [{ membership: 'membership:1', id: 'enterprise:1', kind: 'enterprise', status: 'active', version: 1, default: true }] },
      { read: async () => [{ scope: 'enterprise:1', capabilities: new Set(), version: 1 }] },
      { now: () => new Date() },
      's'.repeat(32),
      NAVIGATION_CATALOG,
      'catalog'
    );
    await expect(
      withReadTransaction(
        async () => result([]),
        (context) => projector.project(context, accessContext(), 'enterprise:1')
      )
    ).rejects.toThrow('ACCESS_VERSION_STALE');
  });
});

function accessContext(): AccessContext {
  const scope = { id: 'enterprise:1', kind: 'enterprise', tenant: 'tenant:1', path: [] } as const;
  return {
    actor: { id: 'principal:1', session: 'session:1', membership: 'membership:1', credentialVersion: 1, accessVersion: 7, target: 'console', assurance: { level: 2 } },
    membership: { id: 'membership:1', active: true, accessVersion: 7, permissions: { allows: new Set(), denies: new Set() }, scopes: [] },
    roles: [],
    organization: 'enterprise:1',
    scope,
    accessVersion: 7,
    capabilities: new Set(),
    capabilityVersion: 11,
    assurance: { level: 2 },
    trace: 'trace:1',
  };
}
