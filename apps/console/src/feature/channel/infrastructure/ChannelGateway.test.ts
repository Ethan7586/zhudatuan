// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { ChannelGateway } from './ChannelGateway';

const proof = 'a'.repeat(43);
const server = setupServer(
  http.patch('*/api/v1/channels/connections/:connection', async ({ request }) => {
    expect(request.headers.get('x-scope-hint')).toBe('enterprise:one');
    expect(request.headers.get('x-access-version')).toBe('7');
    expect(request.headers.get('if-match')).toBe('"5"');
    expect(request.headers.get('idempotency-key')).toBe('command:one');
    expect(request.headers.get('x-action-proof')).toBe(proof);
    expect(request.headers.get('x-csrf-token')).toBe('csrf-token-value');
    const body = (await request.json()) as Record<string, unknown>;
    expect(body).toEqual({ provider: 'jdproduct', configuration: { region: 'cn', baseUrl: 'https://provider.example', healthOperation: 'health', endpoints: { health: '/health' } }, secretRef: 'vault:channel/credential' });
    expect(body).not.toHaveProperty('secret');
    return HttpResponse.json(connection());
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

describe('ChannelGateway', () => {
  it('sends only a secret reference with version, proof and stable command identity', async () => {
    const gateway = new ChannelGateway('http://localhost');
    await gateway.update(
      context,
      'connection:one',
      5,
      { provider: 'jdproduct', region: 'cn', baseUrl: 'https://provider.example', healthOperation: 'health', endpoints: { health: '/health' }, secretRef: 'vault:channel/credential' },
      proof,
      'command:one'
    );
  });
});

const context = { scope: { kind: 'enterprise', id: 'enterprise:one' }, session: { accessVersion: 7, csrf: 'csrf-token-value' } } as ConsoleContext;
function connection() {
  return {
    id: 'connection:one',
    provider: 'jdproduct',
    scope_id: 'enterprise:one',
    status: 'draft',
    contract_version: 'jdproduct.v1',
    region: 'cn',
    connection_timeout_ms: 1000,
    response_timeout_ms: 2000,
    total_deadline_ms: 3000,
    max_concurrency: 4,
    requests_per_second: 5,
    max_attempts: 3,
    failure_threshold: 5,
    recovery_ms: 30000,
    version: 6,
    created_at: '2026-09-03T00:00:00.000Z',
    updated_at: '2026-09-03T00:01:00.000Z',
    has_secret: true,
  };
}
