import { describe, expect, it } from 'vitest';
import type { AccessContext } from '../../../platform/security/AccessContext';
import { NAVIGATION_CATALOG } from '../infrastructure/registry/NavigationCatalog';
import { NavigationProjector } from '../application/service/NavigationProjector';
import { result, withReadTransaction } from '../../../test/TransactionFixture';

describe('NavigationProjector', () => {
  it('reads the organization scopes once and reuses the authorized snapshot', async () => {
    const calls = { organization: 0 };
    const permissions = new Set(NAVIGATION_CATALOG.flatMap((node) => (node.permission === null ? [] : [node.permission])));
    const capabilities = new Set(NAVIGATION_CATALOG.map((node) => node.capability));
    const projector = new NavigationProjector(
      {
        read: async () => {
          calls.organization += 1;
          return [{ membership: 'membership:1', id: 'enterprise:1', kind: 'enterprise', status: 'active', version: 3, default: true }];
        },
      },
      { now: () => new Date('2026-08-29T00:00:00.000Z') },
      's'.repeat(32),
      NAVIGATION_CATALOG,
      'catalog'
    );
    const projection = await withReadTransaction(
      async () => result([]),
      (context) => projector.project(context, accessContext({ permissions, capabilities }), 'enterprise:1')
    );
    expect(calls).toEqual({ organization: 1 });
    expect(projection.tree.nodes.length).toBeGreaterThan(0);
    expect(projection.tree.scope).toEqual({ id: 'enterprise:1', kind: 'enterprise' });
    expect(Object.isFrozen(projection.tree)).toBe(true);
    expect(projection.key.cache).toMatch(/^navigation:v2:[a-f0-9]{64}$/);
    expect(JSON.stringify(projection.tree)).not.toContain('permissions');
  });

  it('rejects a scope that differs from the authorized snapshot', async () => {
    const projector = new NavigationProjector(
      { read: async () => [{ membership: 'membership:1', id: 'enterprise:2', kind: 'enterprise', status: 'active', version: 1, default: true }] },
      { now: () => new Date() },
      's'.repeat(32),
      NAVIGATION_CATALOG,
      'catalog'
    );
    await expect(
      withReadTransaction(
        async () => result([]),
        (context) => projector.project(context, accessContext(), 'enterprise:2')
      )
    ).rejects.toThrow('NAVIGATION_SCOPE_DENIED');
  });
});

function accessContext(values: Readonly<{ permissions?: ReadonlySet<string>; capabilities?: ReadonlySet<string> }> = {}): AccessContext {
  const scope = { id: 'enterprise:1', kind: 'enterprise', tenant: 'tenant:1', path: [] } as const;
  return {
    actor: { id: 'principal:1', session: 'session:1', membership: 'membership:1', credentialVersion: 1, accessVersion: 7, target: 'console', assurance: { level: 2 } },
    membership: { id: 'membership:1', active: true, accessVersion: 7, permissions: { allows: values.permissions ?? new Set(), denies: new Set() }, scopes: [] },
    roles: [],
    organization: 'enterprise:1',
    scope,
    accessVersion: 7,
    capabilities: values.capabilities ?? new Set(),
    capabilityVersion: 11,
    assurance: { level: 2 },
    trace: 'trace:1',
  };
}
