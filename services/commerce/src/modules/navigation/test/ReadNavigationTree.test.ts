import { describe, expect, it } from 'vitest';
import type { AccessContext } from '../../../foundation/security/AccessContext';
import type { NavigationCacheRepository } from '../application/port/NavigationCacheRepository';
import { ReadNavigationTree } from '../application/service/ReadNavigationTree';
import { NavigationKey } from '../domain/model/NavigationKey';
import { NavigationNode } from '../domain/model/NavigationNode';
import { NavigationTree } from '../domain/model/NavigationTree';

describe('ReadNavigationTree', () => {
  it('returns the authoritative projection when Redis is degraded', async () => {
    const cache: NavigationCacheRepository = { get: async () => null, put: async () => false, accept: async () => false, invalidate: async () => false, state: () => ({ available: false, reason: 'REDIS_DOWN' }) };
    const tree = new NavigationTree({
      scope: { id: 'enterprise:1', kind: 'enterprise' },
      target: 'console',
      version: 'v',
      etag: '"v"',
      generatedAt: new Date(0).toISOString(),
      catalogVersion: 'catalog',
      defaultKey: 'root',
      defaultRoute: '/root',
      nodes: [
        new NavigationNode({
          key: 'root',
          title: '首页',
          parent: null,
          order: 1,
          operation: 'catalog.pools.read',
          experience: { icon: 'root', routeKey: 'root', route: '/root', component: 'root', placement: 'primary', disabled: false, disabledReason: null, breadcrumbs: [{ key: 'root', title: '首页' }] },
        }),
      ],
    });
    const projector = {
      project: async () => ({ key: new NavigationKey('s'.repeat(32), { catalog: 'catalog', target: 'console', principal: 'principal:1', membership: 'membership:1', scope: 'enterprise:1', accessVersion: 1, capabilityVersion: 1, featureVersion: 'feature' }), tree }),
    };
    const query = new ReadNavigationTree(projector, cache, { run: async (_key: string, action: () => Promise<unknown>) => action() } as never, 's'.repeat(32), 'catalog', 'feature');
    const result = await query.execute({} as never, accessContext());
    expect(result.status).toBe(200);
    expect(result.body).toEqual(tree.toValue());
    expect(Object.getPrototypeOf(result.body)).toBe(Object.prototype);
  });
});

function accessContext(): AccessContext {
  return {
    actor: { id: 'principal:1', session: 'session:1', membership: 'membership:1', credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: 1 } },
    membership: { id: 'membership:1', active: true, accessVersion: 1, permissions: { allows: new Set(), denies: new Set() }, scopes: [] },
    roles: [],
    organization: 'enterprise:1',
    scope: { id: 'enterprise:1', kind: 'enterprise', tenant: 'tenant:1', path: [] },
    accessVersion: 1,
    capabilities: new Set(),
    capabilityVersion: 1,
    assurance: { level: 1 },
    trace: 'trace:1',
  };
}
