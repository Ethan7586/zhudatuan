import { OperationCatalog, type OperationId } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import type { RouteDefinition } from '../../bootstrap/RouteRegistry';
import { OperationHandler } from '../application/OperationHandler';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS, registerOperationRoutes, type OperationAuthorizer } from './OperationController';

function catalogImportsReadRoute() {
  const container = new Container();
  const handler = new OperationHandler({ invoke: vi.fn(async () => ({ status: 200 })) });
  const handlers = new Map<OperationId, OperationHandler>(
    OperationCatalog.all()
      .filter((candidate) => candidate.module === 'catalog')
      .map((candidate) => [candidate.id, handler])
  );
  const authorize = vi.fn<OperationAuthorizer['authorize']>(async () => {
    throw new Error('STOP_AFTER_SCOPE_CAPTURE');
  });
  const registered: RouteDefinition[] = [];
  container.bind(OPERATION_HANDLERS, handlers);
  container.bind(OPERATION_AUTHORIZER, { authorize });
  registerOperationRoutes('catalog', {
    container,
    routes: { register: (route: RouteDefinition) => registered.push(route) },
  } as unknown as ModuleContext);
  const route = registered.find((candidate) => candidate.operation === 'catalog.imports.read');
  if (!route) throw new Error('TEST_ROUTE_MISSING');
  return { authorize, route };
}

describe('catalog publication task route scope binding', () => {
  it.each(['catalogpublication:latest', 'catalogpublication:task-one'])('authorizes %s from the selected mall Scope', async (reference) => {
    const { authorize, route } = catalogImportsReadRoute();
    const headers = { 'x-scope-hint': 'mall:one' };

    await expect(route.handler({ headers, parameters: { importid: reference } } as never)).rejects.toThrow('STOP_AFTER_SCOPE_CAPTURE');

    expect(authorize).toHaveBeenCalledWith(headers, 'catalog.imports.read', 'catalog.import.read', undefined);
  });

  it('keeps normal catalog imports bound to their concrete import resource', async () => {
    const { authorize, route } = catalogImportsReadRoute();
    const headers = { 'x-scope-hint': 'mall:one' };

    await expect(route.handler({ headers, parameters: { importid: 'catalogimport:one' } } as never)).rejects.toThrow('STOP_AFTER_SCOPE_CAPTURE');

    expect(authorize).toHaveBeenCalledWith(headers, 'catalog.imports.read', 'catalog.import.read', 'catalogimport:one');
  });
});
