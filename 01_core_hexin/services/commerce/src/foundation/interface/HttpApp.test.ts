import { CONTRACT_VERSION } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import type { RouteRegistry } from '../../bootstrap/RouteRegistry';
import { HttpApp } from './HttpApp';

function routes(): RouteRegistry {
  return {
    match: () => ({
      operation: 'identity.sessions.create',
      parameters: {},
      handler: async () => ({ status: 200, body: { accepted: true } }),
    }),
  } as unknown as RouteRegistry;
}

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

  it('ends a request when its total deadline is exhausted', async () => {
    const slow = { match: () => ({ operation: 'identity.sessions.create', parameters: {}, handler: async () => new Promise(() => undefined) }) } as unknown as RouteRegistry;
    const response = await new HttpApp(slow, [], undefined, 5).handle(new Request('https://api.example/api/v1/identity/sessions', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-contract-version': CONTRACT_VERSION }, body: '{}',
    }));
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ code: 'DEADLINE_EXCEEDED' });
  });
});
