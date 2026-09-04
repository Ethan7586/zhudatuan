// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { ChannelGateway } from './ChannelGateway';

const proof = 'a'.repeat(43);
const requests: string[] = [];
const server = setupServer(
  http.patch('*/api/v1/channels/connections/:connection', async ({ request }) => {
    expect(request.headers.get('x-scope-hint')).toBe('enterprise:one');
    expect(request.headers.get('x-access-version')).toBe('7');
    expect(request.headers.get('if-match')).toBe('"5"');
    expect(request.headers.get('idempotency-key')).toBe('command:one');
    expect(request.headers.get('x-action-proof')).toBe(proof);
    expect(request.headers.get('x-csrf-token')).toBe('csrf-token-value');
    const body = (await request.json()) as Record<string, unknown>;
    expect(body).toEqual({ provider: 'jdproduct', configuration: { region: 'cn', baseUrl: 'https://provider.example', healthOperation: 'health', endpoints: { health: '/health' } }, secretRef: 'vault/channel/credential' });
    expect(body).not.toHaveProperty('secret');
    return HttpResponse.json(connection());
  }),
  http.post('*/api/v1/channels/connections', ({ request }) => { requests.push(`${request.method}:create`); return HttpResponse.json(connection()); }),
  http.post('*/api/v1/channels/connections/:connection/tests', ({ request }) => { requests.push(`${request.method}:test`); return HttpResponse.json({ ...control('testing'), state: 'testing' }); }),
  http.put('*/api/v1/channels/connections/:connection/enablement', ({ request }) => { requests.push(`${request.method}:enable`); return HttpResponse.json(control('enabled')); }),
  http.delete('*/api/v1/channels/connections/:connection/enablement', ({ request }) => { requests.push(`${request.method}:disable`); return HttpResponse.json(control('disabled')); }),
  http.post('*/api/v1/channels/syncruns', ({ request }) => { requests.push(`${request.method}:startsync`); return HttpResponse.json(sync('queued')); }),
  http.delete('*/api/v1/channels/syncruns/:run', ({ request }) => { requests.push(`${request.method}:cancelsync`); return HttpResponse.json(sync('cancelled')); }),
  http.post('*/api/v1/channels/operations/:operation/replays', ({ request }) => { requests.push(`${request.method}:replay`); return HttpResponse.json({ operation: 'operation:one', state: 'queued' }); })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => { requests.length = 0; });
afterAll(() => server.close());

describe('ChannelGateway', () => {
  it('sends only a secret reference with version, proof and stable command identity', async () => {
    const gateway = new ChannelGateway('http://localhost');
    await gateway.update(
      context,
      'connection:one',
      5,
      { provider: 'jdproduct', region: 'cn', baseUrl: 'https://provider.example', healthOperation: 'health', endpoints: { health: '/health' }, secretRef: 'vault/channel/credential' },
      proof,
      'command:one'
    );
  });

  it('executes create, test, enable, disable, synchronize, cancel and replay through authoritative operations', async () => {
    const gateway = new ChannelGateway('http://localhost');
    const draft = { provider: 'jdproduct', region: 'cn', baseUrl: 'https://provider.example', healthOperation: 'health', endpoints: { health: '/health' }, secretRef: 'secret/channel/credential' } as const;
    await gateway.create(context, draft, proof, 'command:create');
    await gateway.test(context, 'connection:one', 5, proof, 'command:test');
    await gateway.enable(context, 'connection:one', 5, proof, 'command:enable');
    await gateway.disable(context, 'connection:one', 5, proof, 'command:disable');
    await gateway.startSync(context, { connection: 'connection:one', kind: 'catalog' }, 'command:sync');
    await gateway.cancelSync(context, 'sync:one', 3, 'command:cancel');
    await gateway.replay(context, 'operation:one', proof, 'command:replay');

    expect(requests).toEqual(['POST:create', 'POST:test', 'PUT:enable', 'DELETE:disable', 'POST:startsync', 'DELETE:cancelsync', 'POST:replay']);
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
function control(status: 'testing' | 'enabled' | 'disabled') {
  const value = connection();
  return { id: value.id, provider: value.provider, scope_id: value.scope_id, status, region: value.region, connection_timeout_ms: value.connection_timeout_ms, response_timeout_ms: value.response_timeout_ms, total_deadline_ms: value.total_deadline_ms, max_concurrency: value.max_concurrency, requests_per_second: value.requests_per_second, max_attempts: value.max_attempts, failure_threshold: value.failure_threshold, recovery_ms: value.recovery_ms, version: value.version };
}
function sync(state: 'queued' | 'cancelled') {
  return { id: 'sync:one', connection_id: 'connection:one', kind: 'catalog', state, cursor_value: null, input_hash: 'hash', input: {}, error_summary: [], watermark: null, pulled_count: 0, accepted_count: 0, rejected_count: 0, started_at: null, completed_at: null, version: 3 };
}
