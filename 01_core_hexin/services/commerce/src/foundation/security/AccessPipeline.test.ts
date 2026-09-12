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
import type { OperationAvailabilityResolver } from './OperationAvailability';
import { PipelineAuthorizer } from './PipelineAuthorizer';

const NOW = new Date('2026-08-27T00:00:00.000Z');
const PLATFORM: Scope = Object.freeze({ kind: 'platform', id: 'platform:one', path: [] });
const OWNER: Scope = Object.freeze({ kind: 'owner', id: 'member:one', path: [] });
const OTHER_OWNER: Scope = Object.freeze({ kind: 'owner', id: 'member:other', path: [] });
const MALL: Scope = Object.freeze({ kind: 'mall', id: 'mall:one', path: [{ kind: 'platform' as const, id: 'platform:one' }] });

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

  it.each(Array.from({ length: 32 }, (_, mask) => ({
    mask,
    featureDeclared: Boolean(mask & 1),
    permissionAllowed: Boolean(mask & 2),
    scopeAllowed: Boolean(mask & 4),
    capabilityAvailable: Boolean(mask & 8),
    resourceReady: Boolean(mask & 16),
  })))('fails closed for five-factor combination $mask', async (dimensions) => {
    const fixture = accessFixture('storefront', 'member.profile.read', 'member.profile.read', OWNER, dimensions);
    const expectedAllow = dimensions.featureDeclared && dimensions.permissionAllowed && dimensions.scopeAllowed
      && dimensions.capabilityAvailable && dimensions.resourceReady;

    if (expectedAllow) {
      await expect(fixture.pipeline.authorize({}, 'member.profile.read', 'member.profile.read')).resolves.toMatchObject({ scope: OWNER });
      expect(fixture.decisions).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'allow' }));
    } else {
      await expect(fixture.pipeline.authorize({}, 'member.profile.read', 'member.profile.read')).rejects.toThrow();
      expect(fixture.decisions).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'deny' }));
    }
  });

  it.each([
    [{ featureDeclared: false }, 'FEATURE_NOT_DECLARED'],
    [{ permissionAllowed: false }, 'PERMISSION_DENIED'],
    [{ scopeAllowed: false }, 'SCOPE_DENIED'],
    [{ capabilityAvailable: false }, 'CAPABILITY_DENIED'],
    [{ resourceReady: false }, 'RESOURCE_NOT_READY'],
  ] as const)('records the first unmet authorization dimension', async (overrides, reason) => {
    const fixture = accessFixture('storefront', 'member.profile.read', 'member.profile.read', OWNER, {
      featureDeclared: true,
      permissionAllowed: true,
      scopeAllowed: true,
      capabilityAvailable: true,
      resourceReady: true,
      ...overrides,
    });

    let rejected: unknown;
    try {
      await fixture.pipeline.authorize({}, 'member.profile.read', 'member.profile.read');
    } catch (cause) {
      rejected = cause;
    }
    expect(rejected).toMatchObject({ code: reason });
    expect(fixture.decisions).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'deny', reason }));
  });

  it('does not probe resources before permission, scope, and capability pass', async () => {
    const fixture = accessFixture('storefront', 'member.profile.read', 'member.profile.read', OWNER, {
      ...ALL_DIMENSIONS,
      capabilityAvailable: false,
    });

    await expect(fixture.pipeline.authorize({}, 'member.profile.read', 'member.profile.read')).rejects.toThrow('CAPABILITY_DENIED');
    expect(fixture.availability.resourceReady).not.toHaveBeenCalled();
  });

  it('passes one authorized mall to a handler even when the request body names another mall', async () => {
    const fixture = accessFixture('console', 'catalog.products.create', 'catalog.product.manage', MALL);
    const invoke = vi.fn(async () => ({ status: 201, body: { created: true } }) as const);
    const container = new Container();
    const operationHandler = new OperationHandler({ invoke });
    const handlers = new Map<OperationId, OperationHandler>(
      OperationCatalog.all()
        .filter((operation) => operation.module === 'catalog')
        .map((operation) => [operation.id, operationHandler])
    );
    const registered: RouteDefinition[] = [];
    container.bind(OPERATION_HANDLERS, handlers);
    container.bind(OPERATION_AUTHORIZER, new PipelineAuthorizer(fixture.pipeline));
    registerOperationRoutes('catalog', { container, routes: { register: (route: RouteDefinition) => registered.push(route) } } as unknown as ModuleContext);
    const route = registered.find((candidate) => candidate.operation === 'catalog.products.create');
    if (!route) throw new Error('TEST_ROUTE_MISSING');

    await route.handler({
      method: 'POST',
      path: '/api/v1/catalog/products',
      headers: { 'idempotency-key': 'catalog-product:one', 'x-scope-hint': 'mall:other' },
      parameters: {},
      query: new URLSearchParams(),
      body: { mall_id: 'mall:other', name: 'Other mall product' },
      rawBody: '{"mall_id":"mall:other","name":"Other mall product"}',
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
    });

    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ body: expect.objectContaining({ mall_id: 'mall:other' }) }),
      access: expect.objectContaining({ mall_id: 'mall:one', mallContext: { mall_id: 'mall:one' } }),
    }));
  });
});

interface AccessDimensions {
  readonly featureDeclared: boolean;
  readonly permissionAllowed: boolean;
  readonly scopeAllowed: boolean;
  readonly capabilityAvailable: boolean;
  readonly resourceReady: boolean;
}

const ALL_DIMENSIONS: AccessDimensions = Object.freeze({
  featureDeclared: true,
  permissionAllowed: true,
  scopeAllowed: true,
  capabilityAvailable: true,
  resourceReady: true,
});

function accessFixture(target: Actor['target'], operation: OperationId, permission: string, scope: Scope,
  dimensions: AccessDimensions = ALL_DIMENSIONS) {
  const actor = Object.freeze({ id: 'actor:one', account: 'account:one', realm: 'realm:l0', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target, assurance: { level: 1 } });
  const membershipAccess: MembershipAccess = Object.freeze({
    id: actor.membership,
    active: true,
    accessVersion: actor.accessVersion,
    denies: [],
    grants: dimensions.permissionAllowed
      ? [{ scope, permissions: [permission], effective: '2026-08-26T00:00:00.000Z', expires: null }]
      : [],
  });
  const membership = vi.fn(async () => membershipAccess);
  const risk = vi.fn(async () => ({ outcome: 'allow', safeReason: 'policy', decision: null }) as const);
  const decisions = vi.fn(async () => undefined);
  const availability = {
    resolveFeature: vi.fn(async () => ({
      featureDeclared: dimensions.featureDeclared,
      requiredFeatures: ['identity'],
    })),
    resourceReady: vi.fn(async () => dimensions.resourceReady),
  } satisfies OperationAvailabilityResolver;
  const pipeline = new AccessPipeline(
    { resolve: vi.fn(async () => actor) },
    { resolve: membership },
    { resolve: vi.fn(async () => actor.accessVersion) },
    { resolve: vi.fn(async () => dimensions.scopeAllowed ? scope : OTHER_OWNER) },
    { resolve: vi.fn(async () => dimensions.capabilityAvailable ? [operation] : []) },
    availability,
    { now: () => NOW },
    { evaluate: risk },
    { append: decisions }
  );
  return { pipeline, membership, risk, decisions, availability };
}
