import { OperationCatalog, type OperationId } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import type { RouteDefinition } from '../../bootstrap/RouteRegistry';
import { OperationHandler } from '../application/OperationHandler';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS, registerOperationRoutes } from './OperationController';

describe('finance policy route scope binding', () => {
  it.each(['finance.policies.preview', 'finance.policies.manage'] as const)('authorizes %s from the selected Scope instead of treating a new policy id as a resource', async (operation) => {
    const container = new Container();
    const handler = new OperationHandler({ invoke: vi.fn(async () => ({ status: 200 })) });
    const handlers = new Map<OperationId, OperationHandler>(
      OperationCatalog.all()
        .filter((candidate) => candidate.module === 'finance')
        .map((candidate) => [candidate.id, handler])
    );
    const authorize = vi.fn(async () => {
      throw new Error('STOP_AFTER_SCOPE_CAPTURE');
    });
    const registered: RouteDefinition[] = [];
    container.bind(OPERATION_HANDLERS, handlers);
    container.bind(OPERATION_AUTHORIZER, { authorize });
    registerOperationRoutes('finance', {
      container,
      routes: { register: (route: RouteDefinition) => registered.push(route) },
    } as unknown as ModuleContext);
    const route = registered.find((candidate) => candidate.operation === operation);
    if (!route) throw new Error('TEST_ROUTE_MISSING');
    const headers = {
      'idempotency-key': `policy:${operation}`,
      'if-match': '"0"',
      'x-scope-hint': 'mall:one',
    };

    await expect(route.handler({ headers, parameters: { policyid: 'policy:tax:new' } } as never)).rejects.toThrow('STOP_AFTER_SCOPE_CAPTURE');

    expect(authorize).toHaveBeenCalledWith(headers, operation, 'finance.policy.manage', undefined);
  });
});
