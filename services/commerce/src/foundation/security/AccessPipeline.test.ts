import type { MembershipAccess, Scope } from '@shop/authz';
import { CONTRACT_VERSION, OperationCatalog, type OperationId } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import type { RouteDefinition } from '../../bootstrap/RouteRegistry';
import type { RouteRegistry } from '../../bootstrap/RouteRegistry';
import { OperationHandler } from '../application/OperationHandler';
import { HttpApp } from '../interface/HttpApp';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS, registerOperationRoutes } from '../interface/OperationController';
import { AccessPipeline } from './AccessPipeline';
import type { Actor } from './AccessContext';
import { PipelineAuthorizer } from './PipelineAuthorizer';

const NOW = new Date('2026-08-27T00:00:00.000Z');
const PLATFORM: Scope = Object.freeze({ kind: 'platform', id: 'platform:one', path: [] });
const OWNER: Scope = Object.freeze({ kind: 'owner', id: 'member:one', path: [] });

describe('AccessPipeline audience boundary', () => {
  it.each(['storefront', 'store', 'supplier'] as const)('returns 403 before an operator handler for a %s session', async (target) => {
    const fixture = accessFixture(target, 'access.center.read', 'access.center.read', PLATFORM);
    const invoke = vi.fn(async () => ({ status: 200, body: { exposed: true } }) as const);
    const container = new Container();
    const operationHandler = new OperationHandler({ invoke });
    const handlers = new Map<OperationId, OperationHandler>(
      OperationCatalog.all()
        .filter((operation) => operation.module === 'access')
        .map((operation) => [operation.id, operationHandler])
    );
    const registered: RouteDefinition[] = [];
    container.bind(OPERATION_HANDLERS, handlers);
    container.bind(OPERATION_AUTHORIZER, new PipelineAuthorizer(fixture.pipeline));
    registerOperationRoutes('access', { container, routes: { register: (route: RouteDefinition) => registered.push(route) } } as unknown as ModuleContext);
    const route = registered.find((candidate) => candidate.operation === 'access.center.read');
    if (!route) throw new Error('TEST_ROUTE_MISSING');
    const routes = { match: () => ({ operation: route.operation, handler: route.handler, parameters: {} }) } as unknown as RouteRegistry;

    const response = await new HttpApp(routes, []).handle(
      new Request('https://api.example/api/v1/access/center', {
        headers: { authorization: `Bearer ${'a'.repeat(32)}`, 'x-contract-version': CONTRACT_VERSION },
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: 'PERMISSION_DENIED',
      details: {
        reason: 'AUDIENCE_TARGET_MISMATCH',
        audience: 'operator',
        target,
      },
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(fixture.membership).not.toHaveBeenCalled();
    expect(fixture.decisions).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'access.center.read',
        outcome: 'deny',
        reason: 'PERMISSION_DENIED',
      })
    );
  });

  it('allows an operator operation for a console session', async () => {
    const fixture = accessFixture('console', 'access.center.read', 'access.center.read', PLATFORM);

    await expect(fixture.pipeline.authorize({}, 'access.center.read', 'access.center.read')).resolves.toMatchObject({
      actor: { target: 'console' },
      scope: PLATFORM,
    });
    expect(fixture.decisions).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'allow', reason: 'POLICY_ALLOWED' }));
  });

  it('keeps storefront member operations authorized through the normal policy pipeline', async () => {
    const fixture = accessFixture('storefront', 'member.profile.read', 'member.profile.read', OWNER);

    await expect(fixture.pipeline.authorize({}, 'member.profile.read', 'member.profile.read')).resolves.toMatchObject({
      actor: { target: 'storefront' },
      scope: OWNER,
    });
    expect(fixture.membership).toHaveBeenCalledWith('membership:one');
    expect(fixture.risk).toHaveBeenCalledWith(expect.objectContaining({ operation: 'member.profile.read' }));
  });
});

function accessFixture(target: Actor['target'], operation: OperationId, permission: string, scope: Scope) {
  const actor: Actor = Object.freeze({ id: 'actor:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target, assurance: { level: 1 } });
  const membershipAccess: MembershipAccess = Object.freeze({
    id: actor.membership,
    active: true,
    accessVersion: actor.accessVersion,
    denies: [],
    grants: [{ scope, permissions: [permission], effective: '2026-08-26T00:00:00.000Z', expires: null }],
  });
  const membership = vi.fn(async () => membershipAccess);
  const risk = vi.fn(async () => ({ outcome: 'allow', safeReason: 'policy', decision: null }) as const);
  const decisions = vi.fn(async () => undefined);
  const pipeline = new AccessPipeline(
    { resolve: vi.fn(async () => actor) },
    { resolve: membership },
    { resolve: vi.fn(async () => actor.accessVersion) },
    { resolve: vi.fn(async () => scope) },
    { resolve: vi.fn(async () => [operation]) },
    { now: () => NOW },
    { evaluate: risk },
    { append: decisions }
  );
  return { pipeline, membership, risk, decisions };
}
