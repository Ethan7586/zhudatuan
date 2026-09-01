import { CONTRACT_VERSION, OperationCatalog } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import { RouteRegistry } from '../../src/bootstrap/RouteRegistry';
import { HttpApp } from '../../src/foundation/interface/HttpApp';

function application(handler = vi.fn(async () => ({ status: 200, body: { accepted: true } }))) {
  const routes = new RouteRegistry();
  for (const operation of OperationCatalog.all()) routes.register({ operation: operation.id, handler });
  routes.freeze();
  return { app: new HttpApp(routes, ['https://console.example']), handler };
}

describe('HTTP boundary contract', () => {
  it('rejects an untrusted origin before a handler can observe the request', async () => {
    const { app, handler } = application();
    const response = await app.handle(new Request('https://api.example/api/v1/identity/session', {
      headers: { origin: 'https://attacker.invalid', 'x-contract-version': CONTRACT_VERSION },
    }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'ORIGIN_DENIED' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON and preserves the caller request identifier', async () => {
    const { app, handler } = application();
    const response = await app.handle(new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST',
<<<<<<< HEAD
<<<<<<< HEAD
      headers: { origin: 'https://console.example', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION, 'x-request-id': 'request-contract' },
=======
      headers: { 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION, 'x-request-id': 'request-contract' },
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      headers: { origin: 'https://console.example', 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION, 'x-request-id': 'request-contract' },
>>>>>>> 018b2a71 (chore(release): capture current production source)
      body: '{',
    }));
    expect(response.status).toBe(400);
    expect(response.headers.get('x-request-id')).toBe('request-contract');
    expect(await response.json()).toMatchObject({ code: 'REQUEST_JSON_INVALID', requestId: 'request-contract' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows cookie-authenticated writes without a matching CSRF token', async () => {
    const { app, handler } = application();
<<<<<<< HEAD
<<<<<<< HEAD
    const response = await app.handle(new Request('https://api.example/api/v1/identity/challenges', {
=======
    const response = await app.handle(new Request('https://api.example/api/v1/identity/sessions', {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    const response = await app.handle(new Request('https://api.example/api/v1/identity/challenges', {
>>>>>>> 018b2a71 (chore(release): capture current production source)
      method: 'POST',
      headers: { cookie: 'shop_session=session; shop_csrf=expected', origin: 'https://console.example',
        'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION, 'x-csrf-token': 'wrong' },
      body: '{}',
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accepted: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns the security and contract headers on an accepted request', async () => {
    const { app, handler } = application();
    const response = await app.handle(new Request('https://api.example/api/v1/identity/session', {
      headers: { origin: 'https://console.example', 'x-contract-version': CONTRACT_VERSION },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('strict-transport-security')).toContain('includeSubDomains');
    expect(response.headers.get('access-control-allow-origin')).toBe('https://console.example');
    expect(handler).toHaveBeenCalledOnce();
  });
});
