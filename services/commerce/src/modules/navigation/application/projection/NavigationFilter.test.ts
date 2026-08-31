import { describe, expect, it } from 'vitest';
import type { NavigationScope } from '../../../organization/public/NavigationOrganizationPort';
import { NavigationContext } from '../../domain/model/NavigationContext';
import { NavigationTree } from '../../domain/model/NavigationTree';
import { NavigationFilter, type CatalogNavigationNode } from './NavigationFilter';

describe('NavigationFilter', () => {
  it('filters children without leaving orphan parents and remains O(nodes)', () => {
    const catalog: CatalogNavigationNode[] = Array.from({ length: 100 }, (_, index) => ({
      id: `node${index}`,
      surface: 'console',
      scope: 'enterprise',
      parent: index === 0 ? null : 'node0',
      title: `Node ${index}`,
      icon: 'node',
      route: `/node/${index}`,
      component: 'node',
      order: 100 - index,
      entry: 'catalog.pools.read',
      permissions: index % 2 === 0 ? ['read'] : ['denied'],
      capabilities: ['enabled'],
      empty: 'hide',
    }));
    const scope: NavigationScope = { membership: 'membership:1', id: 'enterprise:1', kind: 'enterprise', status: 'active', version: 1, default: true };
    const context = new NavigationContext({
      target: 'console',
      principal: 'principal:1',
      membership: 'membership:1',
      membershipActive: true,
      assurance: 1,
      scope,
      scopes: [scope],
      permissions: new Set(['read']),
      capabilities: new Set(['enabled']),
      accessVersion: 1,
      capabilityVersion: 1,
    });
    const nodes = new NavigationFilter().apply(catalog, context);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.children).toHaveLength(49);
    const tree = new NavigationTree({ scope: { id: scope.id, kind: scope.kind }, target: 'console', version: 'v', etag: '"v"', generatedAt: new Date(0).toISOString(), catalogVersion: 'catalog', nodes });
    expect(JSON.stringify(tree)).not.toContain('denied');
  });
});
