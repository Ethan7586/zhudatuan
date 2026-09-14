import { CONTRACT_VERSION } from '@shop/contract';
import { resolveNodeContextByHost, type NodeContextResolver, type ResolvedNodeContext } from '@shop/config/sfl-node-kernel';
import { createTelemetry } from '@shop/telemetry';
import { describe, expect, it } from 'vitest';
import { SERVER_NODE_MANIFEST_REGISTRY } from '../../bootstrap/ApiBootstrap';
import type { RouteHandler, RouteRegistry } from '../../bootstrap/RouteRegistry';
import { requireRequestNodeContext } from '../security/AccessContext';
import { OperationMetrics } from '../telemetry/OperationMetrics';
import { HttpApp } from './HttpApp';

function routes(handler: RouteHandler = async () => ({ status: 200, body: { accepted: true } })): RouteRegistry {
  return {
    match: () => ({
      operation: 'identity.sessions.create',
      parameters: {},
      handler,
    }),
  } as unknown as RouteRegistry;
}

describe('HttpApp contract handshake', () => {
  it('resolves one authoritative NodeContext and passes the same object to the operation', async () => {
    let resolveCount = 0;
    let resolved: ResolvedNodeContext | undefined;
    let observed: ResolvedNodeContext | undefined;
    const resolver: NodeContextResolver = {
      registry: SERVER_NODE_MANIFEST_REGISTRY,
      resolve(host) {
        resolveCount += 1;
        resolved = resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, host);
        return resolved;
      },
    };
    const app = new HttpApp(routes(async (request) => {
      observed = requireRequestNodeContext(request.headers);
      return { status: 200, body: { node: observed.node_id } };
    }), [], undefined, undefined, undefined, undefined, resolver);

    const response = await app.handle(new Request('https://api.hbbtzn.com/api/v1/identity/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
      body: '{}',
    }));

    expect(response.status).toBe(200);
    expect(resolveCount).toBe(1);
    expect(observed).toBe(resolved);
    expect(observed).toMatchObject({
      node_id: 'node:hbbtzn:l1',
      signed_level: 'L1',
      surface: 'surface:api',
      scope: { ref: 'mall:d1708f04df2dd8a61736852c4900fb43' },
    });
  });

  it('keeps runtime health requests node-neutral and preserves their status', async () => {
    let resolveCount = 0;
    const healthRoutes = {
      match: () => ({
        operation: 'runtime.health.ready',
        parameters: {},
        handler: async () => ({ status: 200, body: { status: 'ready' } }),
      }),
    } as unknown as RouteRegistry;
    const resolver: NodeContextResolver = {
      registry: SERVER_NODE_MANIFEST_REGISTRY,
      resolve() {
        resolveCount += 1;
        throw new Error('NODE_CONTEXT_NOT_EXPECTED');
      },
    };

    const response = await new HttpApp(healthRoutes, [], undefined, undefined, undefined, undefined, resolver)
      .handle(new Request('http://127.0.0.1/health/ready'));

    expect(response.status).toBe(200);
    expect(resolveCount).toBe(0);
  });

  it('invokes a route when the retired contract version header is missing', async () => {
    const response = await new HttpApp(routes(), []).handle(new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('x-contract-version')).toBeNull();
    expect(response.headers.get('location')).toBeNull();
    expect(await response.json()).toMatchObject({ accepted: true });
  });

  it('accepts the preflight-free login envelope only for the canonical session operation', async () => {
    let observedBody: unknown;
    let observedHeaders: Readonly<Record<string, string>> | undefined;
    const app = new HttpApp(routes(async (request) => {
      observedBody = request.body;
      observedHeaders = request.headers;
      return { status: 200, body: { accepted: true } };
    }), ['https://accounts.hbbtzn.com']);
    const response = await app.handle(new Request('https://api.hbbtzn.com/api/v1/identity/sessions', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
        cookie: 'shop_session=stale-session; shop_csrf=stale-csrf',
        origin: 'https://accounts.hbbtzn.com',
      },
      body: JSON.stringify({
        provider: 'password',
        subject: 'operator',
        password: 'private-password',
        _transport: { idempotencyKey: 'request:login:one', clientVersion: '1.0.0', deviceId: 'device:browser:one' },
      }),
    }));

    expect(response.status).toBe(200);
    expect(observedBody).toEqual({ provider: 'password', subject: 'operator', password: 'private-password' });
    expect(observedHeaders).toMatchObject({
      'idempotency-key': 'request:login:one', 'x-client-version': '1.0.0', 'x-device-id': 'device:browser:one',
    });
    expect(observedHeaders).not.toHaveProperty('_transport');
  });

  it('validates only the console CSRF pair when storefront cookies also exist', async () => {
    const resolver: NodeContextResolver = {
      registry: SERVER_NODE_MANIFEST_REGISTRY,
      resolve: (host) => resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, host),
    };
    const accessRoutes = {
      match: () => ({
        operation: 'access.roles.manage',
        parameters: {},
        handler: async () => ({ status: 200, body: { accepted: true } }),
      }),
    } as unknown as RouteRegistry;
    const request = (csrf: string) => new Request('https://api.hbbtzn.com/api/v1/access/roles/role:one', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        origin: 'https://console.hbbtzn.com',
        cookie: 'shop_console_session=console-session; shop_console_csrf=console-csrf; shop_storefront_session=storefront-session; shop_storefront_csrf=storefront-csrf',
        'x-csrf-token': csrf,
      },
      body: '{}',
    });
    const app = new HttpApp(accessRoutes, ['https://console.hbbtzn.com'], undefined, undefined, undefined, undefined, resolver);

    await expect(app.handle(request('console-csrf'))).resolves.toMatchObject({ status: 200 });
    await expect(app.handle(request('storefront-csrf'))).resolves.toMatchObject({ status: 403 });
  });

  it('rejects the preflight-free envelope on every other operation', async () => {
    const challengeRoutes = {
      match: () => ({ operation: 'identity.challenges.create', parameters: {}, handler: async () => ({ status: 200, body: {} }) }),
    } as unknown as RouteRegistry;
    const response = await new HttpApp(challengeRoutes, ['https://accounts.hbbtzn.com'])
      .handle(new Request('https://api.hbbtzn.com/api/v1/identity/challenges', {
        method: 'POST', headers: { 'content-type': 'text/plain', origin: 'https://accounts.hbbtzn.com' }, body: '{}',
      }));

    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({ code: 'CONTENT_TYPE_UNSUPPORTED' });
  });

  it('clears stale identity cookies without redirecting or retrying server-side', async () => {
    const response = await new HttpApp(routes(), ['https://accounts.zhudatuan.com']).handle(new Request('https://api.zhudatuan.com/api/v1/identity/sessions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'shop_session=old-session; shop_csrf=old-csrf',
        origin: 'https://accounts.zhudatuan.com',
        'x-contract-version': CONTRACT_VERSION,
      },
      body: '{}',
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('set-cookie')).toContain('shop_session=;');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(response.headers.get('set-cookie')).toContain('shop_csrf=;');
    expect(await response.json()).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
  });

  it('records the identity node, realm, operation, version and failing phase without request secrets', async () => {
    const records: Readonly<Record<string, unknown>>[] = [];
    const metrics = new OperationMetrics(createTelemetry((record) => { records.push(record); }));
    const response = await new HttpApp(routes(), ['https://accounts.hbbtzn.com'], undefined, undefined, metrics)
      .handle(new Request('https://api.hbbtzn.com/api/v1/identity/sessions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: 'shop_session=private-session; shop_csrf=private-csrf',
          origin: 'https://accounts.hbbtzn.com',
          authorization: 'Bearer private-bearer-token',
          'x-contract-version': CONTRACT_VERSION,
        },
        body: JSON.stringify({ mobile: '13800138000', password: 'Private-Password-1!', otp: '483921', ticket: 'private-ticket' }),
      }));

    expect(response.status).toBe(403);
    const log = records.find((record) => record.event === 'commerce.operation.completed');
    expect(log).toMatchObject({
      level: 'warn', event: 'commerce.operation.completed', nodeId: 'unresolved', realmId: 'unresolved',
      operation: 'identity.sessions.create', version: CONTRACT_VERSION, phase: 'csrf',
      result: 'failure', errorCode: 'CSRF_TOKEN_INVALID', data: { status: 403 },
    });
    const serialized = JSON.stringify(log);
    for (const secret of ['private-session', 'private-csrf', 'private-bearer-token', '13800138000',
      'Private-Password-1!', '483921', 'private-ticket']) expect(serialized).not.toContain(secret);
  });

  it('accepts an obsolete contract version and records the completed operation', async () => {
    const records: Readonly<Record<string, unknown>>[] = [];
    const metrics = new OperationMetrics(createTelemetry((record) => { records.push(record); }));
    const response = await new HttpApp(routes(), [], undefined, undefined, metrics)
      .handle(new Request('https://api.zhudatuan.com/api/v1/identity/sessions', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-contract-version': '0.0.0' }, body: '{}',
      }));

    expect(response.status).toBe(200);
    expect(records.find((record) => record.event === 'commerce.operation.completed')).toMatchObject({
      level: 'info', event: 'commerce.operation.completed', nodeId: 'unresolved', realmId: 'unresolved',
      operation: 'identity.sessions.create', version: '0.0.0', phase: 'complete',
      result: 'success', data: { status: 200 },
    });
  });

  it('allows the exact generated contract version', async () => {
    const response = await new HttpApp(routes(), ['https://shop.example']).handle(new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'origin': 'https://shop.example', 'x-contract-version': CONTRACT_VERSION },
      body: '{}',
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://shop.example');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('allows the canonical session version header during browser preflight', async () => {
    const response = await new HttpApp(routes(), ['https://shop.example']).handle(new Request('https://api.example/api/v1/members/me', {
      method: 'OPTIONS',
      headers: { origin: 'https://shop.example', 'access-control-request-method': 'GET', 'access-control-request-headers': 'x-access-version' },
    }));
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-headers')).toContain('x-access-version');
    expect(response.headers.get('access-control-allow-headers')).toContain('x-device-id');
    expect(response.headers.get('access-control-max-age')).toBe('7200');
  });

  it('ends a request when its total deadline is exhausted', async () => {
    const slow = { match: () => ({ operation: 'identity.sessions.create', parameters: {}, handler: async () => new Promise(() => undefined) }) } as unknown as RouteRegistry;
    const response = await new HttpApp(slow, [], undefined, 5).handle(new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION }, body: '{}',
    }));
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ code: 'DEADLINE_EXCEEDED' });
  });
});
