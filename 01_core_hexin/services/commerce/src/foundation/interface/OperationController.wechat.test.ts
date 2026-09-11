import { OperationCatalog, type OperationId } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import type { RouteDefinition } from '../../bootstrap/RouteRegistry';
import { OperationHandler, type OperationRequest, type OperationResult } from '../application/OperationHandler';
import { markEnforcedWriteResult } from '../application/ExecutionKernel';
import type { AccessContext } from '../security/AccessContext';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS, registerOperationRoutes, type OperationAuthorizer } from './OperationController';

describe('WeChat session route authentication mode', () => {
  it('loads the current member through the current-session policy when authenticated mode is requested', async () => {
    const invoke = vi.fn(async (_request: OperationRequest): Promise<OperationResult> => markEnforcedWriteResult({ status: 200 }));
    const authorize = vi.fn(async (_headers: Readonly<Record<string, string>>, _operation: string, _permission: string,
      _resource?: string): Promise<AccessContext> => ({ actor: { id: 'principal:current' } } as AccessContext));
    const route = wechatRoute(invoke, authorize);
    const headers = { 'idempotency-key': 'wechat:authenticated', cookie: 'shop_session=current' };

    await route.handler(request(headers, 'authenticated'));

    expect(authorize).toHaveBeenCalledWith(headers, 'identity.session.read', 'identity.session.read', undefined);
    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({ access: expect.objectContaining({ actor: { id: 'principal:current' } }) }));
  });

  it('keeps anonymous WeChat login public', async () => {
    const invoke = vi.fn(async (_request: OperationRequest): Promise<OperationResult> => markEnforcedWriteResult({ status: 200 }));
    const authorize = vi.fn(async (_headers: Readonly<Record<string, string>>, _operation: string, _permission: string,
      _resource?: string): Promise<AccessContext> => { throw new Error('AUTHORIZATION_NOT_EXPECTED'); });
    const route = wechatRoute(invoke, authorize);

    await route.handler(request({ 'idempotency-key': 'wechat:anonymous' }, 'anonymous'));

    expect(authorize).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({ access: null }));
  });
});

function wechatRoute(invoke: (request: OperationRequest) => Promise<OperationResult>, authorize: OperationAuthorizer['authorize']): RouteDefinition {
  const container = new Container();
  const handler = new OperationHandler({ invoke });
  const handlers = new Map<OperationId, OperationHandler>(OperationCatalog.all()
    .filter((operation) => operation.module === 'identity')
    .map((operation) => [operation.id, handler]));
  const registered: RouteDefinition[] = [];
  container.bind(OPERATION_HANDLERS, handlers);
  container.bind(OPERATION_AUTHORIZER, { authorize });
  registerOperationRoutes('identity', {
    container,
    routes: { register: (route: RouteDefinition) => registered.push(route) },
  } as unknown as ModuleContext);
  const route = registered.find((candidate) => candidate.operation === 'identity.wechat.session');
  if (!route) throw new Error('TEST_ROUTE_MISSING');
  return route;
}

function request(headers: Readonly<Record<string, string>>, mode: 'anonymous' | 'authenticated') {
  return {
    method: 'POST',
    path: '/api/v1/identity/wechat/sessions',
    headers,
    parameters: {},
    query: new URLSearchParams(),
    body: { scene: 'jsapi', action: 'authorize', mode, authorization: {} },
    rawBody: '{}',
    deadline: Date.now() + 1_000,
    signal: new AbortController().signal,
  } as const;
}
