// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RouteRegistry } from '../app/RouteRegistry';
import type { ConsoleNavigationNode, ConsoleScope } from '../entity/session/ConsoleSession';
import { guardRoute, landingPath, type RouteAccess } from './RouteGuard';

const scope: ConsoleScope = { kind: 'enterprise', id: 'enterprise:one' };
const nodes: readonly ConsoleNavigationNode[] = [
  node('groupdashboard', 'cockpit', 'consolecockpit', '/scopes/:scopeKind/:scopeId/cockpit', 'reporting.dashboard.read'),
  node('groupsettings', 'settings', 'consolesettings', '/scopes/:scopeKind/:scopeId/settings', 'access.center.read', [node('groupadmin', 'access', 'consoleaccess', '/scopes/:scopeKind/:scopeId/settings/access', 'access.center.read')]),
];
const navigation = { defaultKey: 'groupdashboard', nodes } as const;
const access: RouteAccess = {
  capabilities: ['reporting.dashboard.read', 'access.center.read'],
  permissions: ['reporting.dashboard.read', 'access.center.read'],
};

describe('Console RouteGuard', () => {
  it('allows a generated route only when scope, operation, permission and server navigation all agree', () => {
    expect(guardRoute('/scopes/enterprise/enterprise%3Aone/settings/access', navigation, scope, access, RouteRegistry)).toBeUndefined();
  });

  it('rejects a compiled but hidden deep link before rendering it', async () => {
    const response = await rejected('/scopes/enterprise/enterprise%3Aone/finance', { capabilities: [...access.capabilities, 'finance.overview.read'], permissions: [...access.permissions, 'finance.overview.read'] });
    expect(response.status).toBe(403);
    expect(await response.text()).toBe('NAVIGATION_SCOPE_DENIED');
  });

  it('rejects a route when its generated operation capability is absent', async () => {
    const response = await rejected('/scopes/enterprise/enterprise%3Aone/settings/access', { ...access, capabilities: [] });
    expect(await response.text()).toBe('CAPABILITY_DENIED');
  });

  it('rejects a route when its generated operation permission is absent', async () => {
    const response = await rejected('/scopes/enterprise/enterprise%3Aone/settings/access', { ...access, permissions: [] });
    expect(await response.text()).toBe('PERMISSION_DENIED');
  });

  it('rejects a valid route pattern outside the route declared scope', async () => {
    const platform: ConsoleScope = { kind: 'platform', id: 'platform:one' };
    const response = await rejected('/scopes/platform/platform%3Aone/finance', access, platform);
    expect(await response.text()).toBe('SCOPE_DENIED');
  });

  it('returns the standard not-found error for an unknown route', async () => {
    const response = await rejected('/scopes/enterprise/enterprise%3Aone/private', access);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('RESOURCE_NOT_FOUND');
  });

  it('does not choose a disabled server node as the landing page', () => {
    const values = [node('groupdashboard', 'cockpit', 'consolecockpit', '/scopes/:scopeKind/:scopeId/cockpit', 'reporting.dashboard.read', [], true), nodes[1]!];
    expect(landingPath({ defaultKey: 'groupsettings', nodes: values }, scope, RouteRegistry)).toBe('/scopes/enterprise/enterprise%3Aone/settings');
  });
});

async function rejected(pathname: string, routeAccess: RouteAccess, routeScope: ConsoleScope = scope): Promise<Response> {
  try {
    guardRoute(pathname, navigation, routeScope, routeAccess, RouteRegistry);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  throw new Error('ROUTE_GUARD_DID_NOT_REJECT');
}

function node(
  id: string,
  component: ConsoleNavigationNode['experience']['component'],
  routeKey: ConsoleNavigationNode['experience']['routeKey'],
  route: string,
  operation: ConsoleNavigationNode['operation'],
  children: readonly ConsoleNavigationNode[] = [],
  disabled = false
): ConsoleNavigationNode {
  const title = id === 'groupdashboard' ? '经营驾驶舱' : id === 'groupsettings' ? '系统设置' : '权限管理';
  return {
    key: id,
    title,
    parent: null,
    order: 1,
    operation,
    experience: {
      icon: 'shield',
      routeKey,
      route,
      component,
      placement: 'primary',
      disabled,
      disabledReason: disabled ? '当前范围暂无可用功能' : null,
      breadcrumbs: [{ key: id, title }],
    },
    children,
  };
}
