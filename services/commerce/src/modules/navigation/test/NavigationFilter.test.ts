import { describe, expect, it } from 'vitest';
import type { NavigationScope } from '../../organization/public/NavigationOrganizationPort';
import { NavigationContext } from '../domain/model/NavigationContext';
import { NavigationTree } from '../domain/model/NavigationTree';
import { NavigationFilter, type CatalogNavigationNode } from '../application/service/NavigationFilter';
import { VisibilityPolicy } from '../domain/policy/VisibilityPolicy';

describe('NavigationFilter', () => {
  it('filters children without leaving orphan parents and remains O(nodes)', () => {
    const catalog: CatalogNavigationNode[] = Array.from({ length: 100 }, (_, index) => ({
      key: `node${index}`,
      surface: 'console',
      scope: 'enterprise',
      parent: index === 0 ? null : 'node0',
      title: `导航节点 ${index}`,
      order: 100 - index,
      operation: 'catalog.pools.read',
      owner: 'catalog',
      permission: index % 2 === 0 ? 'catalog.read' : 'catalog.denied',
      capability: 'catalog.enabled',
      featureFlags: ['MVPGROUPPOOL'],
      experience: { icon: 'node', routeKey: `route${index}`, route: `/node/${index}`, component: 'node', placement: index === 0 ? 'primary' : 'secondary', empty: 'hide' },
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
      permissions: new Set(['catalog.read']),
      capabilities: new Set(['catalog.enabled']),
      featureFlags: new Set(['MVPGROUPPOOL']),
      accessVersion: 1,
      capabilityVersion: 1,
    });
    const nodes = new NavigationFilter().apply(catalog, context);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.children).toHaveLength(49);
    const tree = new NavigationTree({
      scope: { id: scope.id, kind: scope.kind },
      target: 'console',
      version: 'v',
      etag: '"v"',
      generatedAt: new Date(0).toISOString(),
      catalogVersion: 'catalog',
      defaultKey: 'node0',
      defaultRoute: '/node/0',
      nodes,
    });
    expect(JSON.stringify(tree)).not.toContain('denied');
  });

  it('keeps allowed descendants under an explained disabled parent and produces stable deep-link breadcrumbs', () => {
    const catalog = [catalogNode('rootb', null, 10, '/b'), catalogNode('roota', null, 10, '/a', { permission: 'parent.denied' }), catalogNode('child', 'roota', 1, '/a/:recordId', { placement: 'contextual' })];
    const nodes = new NavigationFilter().apply(catalog, context());
    expect(nodes.map(({ key }) => key)).toEqual(['roota', 'rootb']);
    expect(nodes[0]?.experience).toMatchObject({ disabled: true, disabledReason: '当前身份无此权限' });
    expect(nodes[0]?.children[0]?.experience.breadcrumbs).toEqual([
      { key: 'roota', title: '导航 roota' },
      { key: 'child', title: '导航 child' },
    ]);
  });

  it('uses one policy for membership, scope, client, permission, capability and feature flags', () => {
    const policy = new VisibilityPolicy();
    const candidate = catalogNode('node', null, 1, '/node');
    expect(policy.decide(candidate, context({ membershipActive: false }))).toBe('membership');
    expect(policy.decide({ ...candidate, scope: 'mall' }, context())).toBe('scope');
    expect(policy.decide({ ...candidate, surface: 'storefront' }, context())).toBe('client');
    expect(policy.decide({ ...candidate, permission: 'catalog.denied' }, context())).toBe('permission');
    expect(policy.decide({ ...candidate, capability: 'catalog.denied' }, context())).toBe('capability');
    expect(policy.decide({ ...candidate, featureFlags: ['MVPUNKNOWN'] }, context())).toBe('feature');
    expect(policy.decide(candidate, context())).toBe('visible');
  });
});

function catalogNode(key: string, parent: string | null, order: number, route: string, override: Partial<CatalogNavigationNode['experience']> & Partial<Pick<CatalogNavigationNode, 'permission' | 'capability'>> = {}): CatalogNavigationNode {
  return {
    key,
    surface: 'console',
    scope: 'enterprise',
    parent,
    title: `导航 ${key}`,
    order,
    operation: 'catalog.pools.read',
    owner: 'catalog',
    permission: override.permission ?? 'catalog.read',
    capability: override.capability ?? 'catalog.enabled',
    featureFlags: ['MVPGROUPPOOL'],
    experience: { icon: 'node', routeKey: `${key}route`, route, component: 'node', placement: override.placement ?? 'primary', empty: 'hide' },
  };
}

function context(override: Partial<{ membershipActive: boolean }> = {}): NavigationContext {
  const scope: NavigationScope = { membership: 'membership:one', id: 'enterprise:one', kind: 'enterprise', status: 'active', version: 1, default: true };
  return new NavigationContext({
    target: 'console',
    principal: 'principal:one',
    membership: 'membership:one',
    membershipActive: override.membershipActive ?? true,
    assurance: 1,
    scope,
    scopes: [scope],
    permissions: new Set(['catalog.read']),
    capabilities: new Set(['catalog.enabled']),
    featureFlags: new Set(['MVPGROUPPOOL']),
    accessVersion: 1,
    capabilityVersion: 1,
  });
}
