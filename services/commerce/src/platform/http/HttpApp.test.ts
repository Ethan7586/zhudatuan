import { BrowserRequestHeaders, BrowserResponseHeaders, CONTRACT_VERSION } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import type { RouteRegistry } from '../../composition/RouteRegistry';
import { CsrfProtector } from '../security/CsrfProtector';
import { HttpApp } from './HttpApp';
import type { OperationMetrics } from '../telemetry/OperationMetrics';
import { HttpStream } from './HttpStream';

const csrf = new CsrfProtector('http-app-test-key-that-is-at-least-thirty-two-bytes', {
  console: 'https://shop.example',
  storefront: 'https://shop.example',
  miniapp: 'https://shop.example',
  store: 'https://shop.example',
  supplier: 'https://shop.example',
});

function routes(operation = 'identity.sessions.create'): RouteRegistry {
  return {
    match: () => ({
      operation,
      parameters: {},
      handler: async () => ({ status: 200, body: { accepted: true } }),
    }),
  } as unknown as RouteRegistry;
}

describe('HttpApp contract handshake', () => {
  it('returns upgrade required before invoking a route with a missing contract version', async () => {
    const response = await new HttpApp(routes(), ['https://shop.example'], csrf).handle(
      new Request('https://api.example/api/v1/identity/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://shop.example', 'x-client-target': 'storefront' },
        body: '{}',
      })
    );
    expect(response.status).toBe(426);
    expect(response.headers.get('x-contract-version')).toBe(CONTRACT_VERSION);
    expect(await response.json()).toMatchObject({ code: 'CONTRACT_VERSION_UNSUPPORTED', retryable: false });
  });

  it('allows the exact generated contract version', async () => {
    const response = await new HttpApp(routes(), ['https://shop.example'], csrf).handle(
      new Request('https://api.example/api/v1/identity/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://shop.example', 'x-contract-version': CONTRACT_VERSION, 'x-client-target': 'storefront', cookie: '__Host-auth-csrf=bootstrap-token', 'x-csrf-token': 'bootstrap-token' },
        body: '{}',
      })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://shop.example');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('uses the anonymous bootstrap token even when an older target session cookie is present', async () => {
    const response = await new HttpApp(routes('identity.challenges.create'), ['https://shop.example'], csrf).handle(
      new Request('https://api.example/api/v1/identity/challenges', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: '__Host-console-session=older-session; __Host-console-csrf=older-session-csrf; __Host-auth-csrf=fresh-bootstrap',
          origin: 'https://shop.example',
          'x-contract-version': CONTRACT_VERSION,
          'x-client-target': 'console',
          'x-csrf-token': 'fresh-bootstrap',
        },
        body: '{}',
      })
    );
    expect(response.status).toBe(200);
  });

  it('does not accept a target-session token for an anonymous authentication write', async () => {
    const response = await new HttpApp(routes('identity.challenges.create'), ['https://shop.example'], csrf).handle(
      new Request('https://api.example/api/v1/identity/challenges', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: '__Host-console-session=older-session; __Host-console-csrf=older-session-csrf; __Host-auth-csrf=fresh-bootstrap',
          origin: 'https://shop.example',
          'x-contract-version': CONTRACT_VERSION,
          'x-client-target': 'console',
          'x-csrf-token': 'older-session-csrf',
        },
        body: '{}',
      })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
  });

  it('allows every canonical browser request header and exposes every canonical response header', async () => {
    const response = await new HttpApp(routes(), ['https://shop.example'], csrf).handle(
      new Request('https://api.example/api/v1/carts/current', {
        method: 'OPTIONS',
        headers: {
          origin: 'https://shop.example',
          'access-control-request-method': 'PUT',
          'access-control-request-headers': BrowserRequestHeaders.join(','),
        },
      })
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://shop.example');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    const allowed = response.headers.get('access-control-allow-headers')?.split(',') ?? [];
    expect(allowed).toEqual([...BrowserRequestHeaders]);
    expect(response.headers.get('access-control-expose-headers')?.split(',')).toEqual([...BrowserResponseHeaders]);
  });

  it('rejects a stale authenticated API cookie on public registration without its matching CSRF token', async () => {
    const response = await new HttpApp(routes('identity.invitations.resolve'), ['https://passport.yengze.press'], csrf).handle(
      new Request('https://api.yengze.press/api/v1/identity/invitations/resolve', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: '__Host-storefront-session=stale-session; __Host-storefront-csrf=api-host-only-token',
          origin: 'https://passport.yengze.press',
          'x-contract-version': CONTRACT_VERSION,
          'x-client-target': 'storefront',
        },
        body: '{}',
      })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
  });

  it('accepts a signed CSRF token only for its bound session, target and origin', async () => {
    const token = csrf.issue('session-secret', 'storefront', 60);
    const response = await new HttpApp(routes('cart.items.batch'), ['https://shop.example'], csrf).handle(
      new Request('https://api.example/api/v1/carts/current/items', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: `__Host-storefront-session=session-secret; __Host-storefront-csrf=${token}`,
          origin: 'https://shop.example',
          'x-contract-version': CONTRACT_VERSION,
          'x-client-target': 'storefront',
          'x-csrf-token': token,
        },
        body: '{}',
      })
    );
    expect(response.status).toBe(200);
  });

  it('accepts the anonymous bootstrap CSRF token for an optional-assurance cart write', async () => {
    const response = await new HttpApp(routes('cart.items.batch'), ['https://shop.example'], csrf).handle(
      new Request('https://api.example/api/v1/carts/current/items', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: '__Host-auth-csrf=guest-bootstrap',
          origin: 'https://shop.example',
          'x-cart-token': 'abcdefghijklmnopqrstuvwxyzABCDEFGH123456789',
          'x-contract-version': CONTRACT_VERSION,
          'x-client-target': 'storefront',
          'x-csrf-token': 'guest-bootstrap',
        },
        body: '{}',
      })
    );
    expect(response.status).toBe(200);
  });

  it('requires the signed session CSRF token when optional assurance resolves to a member session', async () => {
    const response = await new HttpApp(routes('cart.items.batch'), ['https://shop.example'], csrf).handle(
      new Request('https://api.example/api/v1/carts/current/items', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: '__Host-auth-csrf=guest-bootstrap; __Host-storefront-session=member-session; __Host-storefront-csrf=unsigned-token',
          origin: 'https://shop.example',
          'x-cart-token': 'abcdefghijklmnopqrstuvwxyzABCDEFGH123456789',
          'x-contract-version': CONTRACT_VERSION,
          'x-client-target': 'storefront',
          'x-csrf-token': 'guest-bootstrap',
        },
        body: '{}',
      })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
  });

  it('allows an authenticated console operation to manage a different target surface', async () => {
    const token = csrf.issue('console-session-secret', 'console', 60);
    const response = await new HttpApp(routes('identity.invitations.create'), ['https://shop.example'], csrf).handle(
      new Request('https://api.example/api/v1/identity/invitations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `__Host-console-session=console-session-secret; __Host-console-csrf=${token}`,
          origin: 'https://shop.example',
          'x-contract-version': CONTRACT_VERSION,
          'x-client-target': 'console',
          'x-csrf-token': token,
        },
        body: JSON.stringify({ target: 'storefront' }),
      })
    );
    expect(response.status).toBe(200);
  });

  it('rejects a public authentication body bound to a different client target', async () => {
    const response = await new HttpApp(routes(), ['https://shop.example'], csrf).handle(
      new Request('https://api.example/api/v1/identity/sessions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: '__Host-auth-csrf=bootstrap-token',
          origin: 'https://shop.example',
          'x-contract-version': CONTRACT_VERSION,
          'x-client-target': 'storefront',
          'x-csrf-token': 'bootstrap-token',
        },
        body: JSON.stringify({ target: 'console' }),
      })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'AUTHORIZATION_DENIED' });
  });

  it('rejects canonical public registration without an approved browser origin', async () => {
    const response = await new HttpApp(routes('identity.invitations.resolve'), ['https://passport.yengze.press'], csrf).handle(
      new Request('https://api.yengze.press/api/v1/identity/invitations/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION, 'x-client-target': 'storefront' },
        body: '{}',
      })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'ORIGIN_REQUIRED' });
  });

  it('ends a request when its total deadline is exhausted', async () => {
    const slow = { match: () => ({ operation: 'identity.sessions.create', parameters: {}, handler: async () => new Promise(() => undefined) }) } as unknown as RouteRegistry;
    const response = await new HttpApp(slow, ['https://shop.example'], csrf, undefined, 5).handle(
      new Request('https://api.example/api/v1/identity/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://shop.example', 'x-contract-version': CONTRACT_VERSION, 'x-client-target': 'storefront', cookie: '__Host-auth-csrf=bootstrap-token', 'x-csrf-token': 'bootstrap-token' },
        body: '{}',
      })
    );
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ code: 'DEADLINE_EXCEEDED' });
  });

  it('records browser navigation cancellation without reporting an internal failure', async () => {
    const controller = new AbortController();
    const failures: unknown[] = [];
    const cancellations: unknown[] = [];
    const metrics = {
      failure: (...values: unknown[]) => failures.push(values),
      cancelled: (...values: unknown[]) => cancellations.push(values),
      observe: () => undefined,
    } as unknown as OperationMetrics;
    const pending = {
      match: () => ({
        operation: 'identity.providers.read',
        parameters: {},
        handler: async (input: Readonly<{ signal: AbortSignal }>) => new Promise((_, reject) => input.signal.addEventListener('abort', () => reject(input.signal.reason), { once: true })),
      }),
    } as unknown as RouteRegistry;
    const responsePromise = new HttpApp(pending, ['https://shop.example'], csrf, undefined, 500, metrics).handle(
      new Request('https://api.example/api/v1/identity/providers', {
        headers: { origin: 'https://shop.example', 'x-contract-version': CONTRACT_VERSION, 'x-client-target': 'storefront' },
        signal: controller.signal,
      })
    );
    controller.abort(new Error('REQUEST_ABORTED'));
    expect((await responsePromise).status).toBe(499);
    expect(failures).toHaveLength(0);
    expect(cancellations).toHaveLength(1);
  });

  it('preserves a declared typed operation rejection instead of converting it to an internal error', async () => {
    const rejected = {
      match: () => ({
        operation: 'identity.sessions.create',
        parameters: {},
        handler: async () => ({
          status: 401,
          body: { code: 'CREDENTIAL_INVALID' },
        }),
      }),
    } as unknown as RouteRegistry;
    const response = await new HttpApp(rejected, ['https://shop.example'], csrf).handle(
      new Request('https://api.example/api/v1/identity/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://shop.example', 'x-contract-version': CONTRACT_VERSION, 'x-client-target': 'storefront', cookie: '__Host-auth-csrf=bootstrap-token', 'x-csrf-token': 'bootstrap-token' },
        body: '{}',
      })
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'CREDENTIAL_INVALID', message: 'REQUEST_FAILED', requestId: expect.any(String) });
  });

  it('fails closed when a handler returns an undeclared status and code pair', async () => {
    const rejected = {
      match: () => ({
        operation: 'identity.sessions.create',
        parameters: {},
        handler: async () => ({
          status: 409,
          body: { code: 'CREDENTIAL_INVALID' },
        }),
      }),
    } as unknown as RouteRegistry;
    const response = await new HttpApp(rejected, ['https://shop.example'], csrf).handle(
      new Request('https://api.example/api/v1/identity/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://shop.example', 'x-contract-version': CONTRACT_VERSION, 'x-client-target': 'storefront', cookie: '__Host-auth-csrf=bootstrap-token', 'x-csrf-token': 'bootstrap-token' },
        body: '{}',
      })
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('returns a secure incremental SSE response without applying the JSON boundary', async () => {
    const streamRoutes = {
      match: () => ({
        operation: 'support.events.read',
        parameters: {},
        handler: async () => ({
          status: 200,
          body: new HttpStream(async function* () {
            yield { id: 'event:1', event: 'support.message.sent', data: { ticketId: 'ticket:one' } };
          }),
        }),
      }),
    } as unknown as RouteRegistry;
    const response = await new HttpApp(streamRoutes, ['https://shop.example'], csrf).handle(
      new Request('https://api.example/api/v1/support/events', {
        headers: { origin: 'https://shop.example', 'x-contract-version': CONTRACT_VERSION, 'x-client-target': 'console' },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-cache, no-transform');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(await response.text()).toContain('id: event:1\nevent: support.message.sent\ndata: {"ticketId":"ticket:one"}\n\n');
  });

  it('does not infer a public protocol error from a legacy raw error message', async () => {
    const rejected = {
      match: () => ({
        operation: 'identity.invitations.resolve',
        parameters: {},
        handler: async () => {
          throw new Error('INVITATION_INVALID');
        },
      }),
    } as unknown as RouteRegistry;
    const response = await new HttpApp(rejected, ['https://shop.example'], csrf).handle(
      new Request('https://api.example/api/v1/identity/invitations/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://shop.example', 'x-contract-version': CONTRACT_VERSION, 'x-client-target': 'storefront', cookie: '__Host-auth-csrf=bootstrap-token', 'x-csrf-token': 'bootstrap-token' },
        body: '{}',
      })
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: 'INTERNAL_ERROR', requestId: expect.any(String), retryable: true });
  });
});
