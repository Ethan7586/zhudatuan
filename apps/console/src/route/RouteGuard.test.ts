// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RouteRegistry } from '../app/RouteRegistry';
import type { ConsoleNavigationNode, ConsoleScope } from '../entity/session/ConsoleSession';
import { guardRoute, landingPath } from './RouteGuard';

const scope: ConsoleScope = { kind: 'enterprise', id: 'enterprise:one' };
const nodes: readonly ConsoleNavigationNode[] = [
  node('groupdashboard', 'cockpit', '/scopes/:scopeKind/:scopeId/cockpit'),
  node('groupsettings', 'settings', '/scopes/:scopeKind/:scopeId/settings', [node('groupadmin', 'access', '/scopes/:scopeKind/:scopeId/settings/access')]),
];

describe('Console RouteGuard', () => {
  it('allows registered components present in the server tree', () => {
    expect(guardRoute('/scopes/enterprise/enterprise%3Aone/settings/access', nodes, scope, RouteRegistry)).toBeUndefined();
  });

  it('redirects a compiled but hidden deep link before rendering it', () => {
    const response = guardRoute('/scopes/enterprise/enterprise%3Aone/finance', nodes, scope, RouteRegistry);
    expect(response).toBeInstanceOf(Response);
    expect(response?.status).toBe(302);
    expect(response?.headers.get('location')).toBe('/scopes/enterprise/enterprise%3Aone/cockpit');
  });

  it('returns 404 for an unknown route and never guesses a component', () => {
    expect(() => guardRoute('/scopes/enterprise/enterprise%3Aone/private', nodes, scope, RouteRegistry)).toThrowError(Response);
  });

  it('does not choose a disabled server node as the landing page', () => {
    const values = [node('groupdashboard', 'cockpit', '/scopes/:scopeKind/:scopeId/cockpit', [], true), nodes[1]!];
    expect(landingPath(values, scope, RouteRegistry)).toBe('/scopes/enterprise/enterprise%3Aone/settings');
  });
});

function node(id: string, component: ConsoleNavigationNode['component'], route: string, children: readonly ConsoleNavigationNode[] = [], disabled = false): ConsoleNavigationNode {
  return { id, title: id, icon: 'shield', route, component, order: 1, entry: 'test.read', disabled, children };
}
