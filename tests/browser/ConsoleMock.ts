import type { Page } from '@playwright/test';
import { NAVIGATION_CATALOG, NAVIGATION_CATALOG_HASH } from '../../services/commerce/src/modules/navigation/infrastructure/catalog/NavigationCatalog';
import { OperationMock } from './OperationMock';

export interface ConsoleSessionFixture {
  readonly scope: Readonly<{ kind: string; id: string }>;
  readonly permissions: readonly string[];
  readonly capabilities: readonly string[];
}

export function createConsoleMock(page: Page, session: ConsoleSessionFixture): OperationMock {
  return new OperationMock(page)
    .get('/api/v1/identity/session', session)
    .get('/api/v1/members/me', {
      id: 'member:e2e',
      display_name: '验收管理员',
      status: 'active',
      mobile_bound: true,
      membership_id: 'membership:console:e2e',
      organization_id: session.scope.id,
      employee_no: 'E2E001',
      joined_at: '2026-08-01T00:00:00.000Z',
      access_version: 1,
    })
    .get('/api/v1/navigation', navigationProjection(session));
}

function navigationProjection(session: ConsoleSessionFixture) {
  const candidates = NAVIGATION_CATALOG.filter(
    (node) =>
      node.surface === 'console' && node.scope === session.scope.kind && node.permissions.every((permission) => session.permissions.includes(permission)) && node.capabilities.every((capability) => session.capabilities.includes(capability))
  ).filter((node) => node.parent === null);
  const preferred = candidates.sort((left, right) => Number(right.scope === session.scope.kind) - Number(left.scope === session.scope.kind) || left.order - right.order);
  const nodes = [...new Map(preferred.map((node) => [node.component, node] as const)).values()]
    .sort((left, right) => left.order - right.order)
    .map((node) => ({
      id: node.id,
      title: node.title,
      icon: node.icon,
      route: node.route,
      component: node.component,
      order: node.order,
      entry: node.entry,
      disabled: false,
      children: [],
    }));
  return Object.freeze({
    scope: Object.freeze({ id: session.scope.id, kind: session.scope.kind }),
    target: 'console',
    version: 'e2e',
    etag: `e2e:${session.scope.kind}:${session.scope.id}`,
    generatedAt: '2026-08-30T00:00:00.000Z',
    catalogVersion: NAVIGATION_CATALOG_HASH,
    nodes: Object.freeze(nodes),
  });
}
