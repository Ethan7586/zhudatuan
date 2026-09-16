import { type OperationId } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import type { RouteDefinition } from '../../bootstrap/RouteRegistry';
import { OperationHandler } from '../application/OperationHandler';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS, registerSelectedOperationRoutes, type OperationAuthorizer } from './OperationController';

const memberTargetOperations = [
  'member.storefront.detail.read',
  'member.storefront.invitees.read',
  'member.storefront.orders.read',
  'member.storefront.custom.read',
  'member.storefront.custom.manage',
] as const satisfies readonly OperationId[];

describe('storefront member target scope', () => {
  it.each(memberTargetOperations)('%s resolves the selected mall, not the target Membership as a Scope', async (operation) => {
    const container = new Container();
    const handler = new OperationHandler({ invoke: vi.fn(async () => ({ status: 200 })) });
    const authorize = vi.fn<OperationAuthorizer['authorize']>(async () => {
      throw new Error('STOP_AFTER_SCOPE_CAPTURE');
    });
    const routes: RouteDefinition[] = [];
    container.bind(OPERATION_HANDLERS, new Map([[operation, handler]]));
    container.bind(OPERATION_AUTHORIZER, { authorize });
    registerSelectedOperationRoutes([operation], {
      container,
      routes: { register: (route: RouteDefinition) => routes.push(route) },
    } as unknown as ModuleContext);
    const headers = { 'x-scope-hint': 'mall:one' };

    await expect(routes[0]!.handler({
      headers,
      parameters: { membershipid: 'membership:storefront:one' },
    } as never)).rejects.toThrow('STOP_AFTER_SCOPE_CAPTURE');

    expect(authorize).toHaveBeenCalledWith(headers, operation, 'member.read', undefined);
  });
});
