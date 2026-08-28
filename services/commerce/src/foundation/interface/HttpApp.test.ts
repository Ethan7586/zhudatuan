import { CONTRACT_VERSION } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import type { RouteRegistry } from '../../bootstrap/RouteRegistry';
import { HttpApp } from './HttpApp';

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
    const response = await new HttpApp(routes(), ['https://shop.example']).handle(new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://shop.example' },
      body: '{}',
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accepted: true });
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

  it('allows the SDK access-version and action-proof headers in credentialed preflight', async () => {
    const response = await new HttpApp(routes(), ['https://shop.example']).handle(new Request('https://api.example/api/v1/carts/current', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://shop.example',
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'x-access-version,x-action-proof',
      },
    }));
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://shop.example');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    const allowed = response.headers.get('access-control-allow-headers')?.split(',') ?? [];
    expect(allowed).toContain('x-access-version');
    expect(allowed).toContain('x-action-proof');
  });

  it('rejects a stale authenticated API cookie on public registration without its matching CSRF token', async () => {
    const response = await new HttpApp(routes('identity.members.create'), ['https://accounts.zhudatuan.com']).handle(new Request('https://api.zhudatuan.com/api/v1/identity/members', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'shop_session=stale-session; shop_csrf=api-host-only-token',
        origin: 'https://accounts.zhudatuan.com',
        'x-contract-version': CONTRACT_VERSION,
      },
      body: '{}',
    }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'CSRF_TOKEN_INVALID' });
  });

  it('rejects canonical public registration without an approved browser origin', async () => {
    const response = await new HttpApp(routes('identity.members.create'), ['https://accounts.zhudatuan.com']).handle(new Request('https://api.zhudatuan.com/api/v1/identity/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
      body: '{}',
    }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'ORIGIN_REQUIRED' });
  });

  it('ends a request when its total deadline is exhausted', async () => {
    const slow = { match: () => ({ operation: 'identity.sessions.create', parameters: {}, handler: async () => new Promise(() => undefined) }) } as unknown as RouteRegistry;
    const response = await new HttpApp(slow, ['https://shop.example'], undefined, 5).handle(new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://shop.example', 'x-contract-version': CONTRACT_VERSION }, body: '{}',
    }));
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ code: 'DEADLINE_EXCEEDED' });
  });
});
