import { CONTRACT_VERSION } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import type { RouteRegistry } from '../../bootstrap/RouteRegistry';
import { HttpApp } from './HttpApp';

<<<<<<< HEAD
function routes(operation = 'identity.sessions.create'): RouteRegistry {
  return {
    match: () => ({
      operation,
=======
function routes(): RouteRegistry {
  return {
    match: () => ({
      operation: 'identity.sessions.create',
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      parameters: {},
      handler: async () => ({ status: 200, body: { accepted: true } }),
    }),
  } as unknown as RouteRegistry;
}

<<<<<<< HEAD
describe('HttpApp request dispatch', () => {
  it('invokes a route without a contract-version header', async () => {
    const response = await new HttpApp(routes(), ['https://shop.example']).handle(new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://shop.example' },
      body: '{}',
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accepted: true });
=======
describe('HttpApp contract handshake', () => {
  it('returns upgrade required before invoking a route with a missing contract version', async () => {
    const response = await new HttpApp(routes(), []).handle(new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }));
    expect(response.status).toBe(426);
    expect(response.headers.get('x-contract-version')).toBe(CONTRACT_VERSION);
    expect(await response.json()).toMatchObject({ code: 'CONTRACT_VERSION_UNSUPPORTED', required: CONTRACT_VERSION });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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

<<<<<<< HEAD
  it('allows an authenticated API cookie without a CSRF token', async () => {
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
    expect(response.status).toBe(200);
  });

  it('allows canonical public registration without a browser origin', async () => {
    const response = await new HttpApp(routes('identity.members.create'), ['https://accounts.zhudatuan.com']).handle(new Request('https://api.zhudatuan.com/api/v1/identity/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION },
      body: '{}',
    }));
    expect(response.status).toBe(200);
  });

  it('allows authorization-context headers in an approved-origin preflight', async () => {
    const response = await new HttpApp(routes(), ['https://shop.example']).handle(new Request('https://api.example/api/v1/finance/settlements/one/decide', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://shop.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'x-access-version,x-action-proof,if-match,idempotency-key',
      },
    }));
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-headers')).toContain('x-access-version');
    expect(response.headers.get('access-control-allow-headers')).toContain('x-action-proof');
  });

  it('ends a request when its total deadline is exhausted', async () => {
    const slow = { match: () => ({ operation: 'identity.sessions.create', parameters: {}, handler: async () => new Promise(() => undefined) }) } as unknown as RouteRegistry;
    const response = await new HttpApp(slow, ['https://shop.example'], undefined, 5).handle(new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://shop.example', 'x-contract-version': CONTRACT_VERSION }, body: '{}',
=======
  it('ends a request when its total deadline is exhausted', async () => {
    const slow = { match: () => ({ operation: 'identity.sessions.create', parameters: {}, handler: async () => new Promise(() => undefined) }) } as unknown as RouteRegistry;
    const response = await new HttpApp(slow, [], undefined, 5).handle(new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION }, body: '{}',
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    }));
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ code: 'DEADLINE_EXCEEDED' });
  });
});
