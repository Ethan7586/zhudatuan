import { OperationCatalog, type OperationId } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import type { RouteDefinition } from '../../bootstrap/RouteRegistry';
import { OperationHandler } from '../application/OperationHandler';
import {
  OPERATION_AUTHORIZER,
  OPERATION_HANDLERS,
  registerOperationRoutes,
  type OperationAuthorizer,
} from './OperationController';

function accessRolesManageRoute() {
  const container = new Container();
  const handler = new OperationHandler({ invoke: vi.fn(async () => ({ status: 200 })) });
  const handlers = new Map<OperationId, OperationHandler>(
    OperationCatalog.all()
      .filter((candidate) => candidate.module === 'access')
      .map((candidate) => [candidate.id, handler])
  );
  const authorize = vi.fn<OperationAuthorizer['authorize']>(async () => {
    throw new Error('STOP_AFTER_SCOPE_CAPTURE');
  });
  const registered: RouteDefinition[] = [];
  container.bind(OPERATION_HANDLERS, handlers);
  container.bind(OPERATION_AUTHORIZER, { authorize });
  registerOperationRoutes('access', {
    container,
    routes: { register: (route: RouteDefinition) => registered.push(route) },
  } as unknown as ModuleContext);
  const route = registered.find((candidate) => candidate.operation === 'access.roles.manage');
  if (!route) throw new Error('TEST_ROUTE_MISSING');
  return { authorize, route };
}

describe('access role management authorization resource', () => {
  it('authorizes administrator offboarding against the selected management Scope', async () => {
    const { authorize, route } = accessRolesManageRoute();
    const headers = { 'x-scope-hint': 'mall:one' };

    await expect(route.handler({
      headers,
      parameters: { roleid: 'role:self' },
      body: { action: 'offboard', membership: 'membership:target' },
    } as never)).rejects.toThrow('STOP_AFTER_SCOPE_CAPTURE');

    expect(authorize).toHaveBeenCalledWith(
      headers,
      'access.roles.manage',
      'access.role.manage',
      undefined,
    );
  });

  it('keeps normal role changes bound to the concrete role resource', async () => {
    const { authorize, route } = accessRolesManageRoute();
    const headers = { 'x-scope-hint': 'mall:one' };

    await expect(route.handler({
      headers,
      parameters: { roleid: 'role:finance' },
      body: { name: '财务管理员', permissions: [] },
    } as never)).rejects.toThrow('STOP_AFTER_SCOPE_CAPTURE');

    expect(authorize).toHaveBeenCalledWith(
      headers,
      'access.roles.manage',
      'access.role.manage',
      'role:finance',
    );
  });
});
