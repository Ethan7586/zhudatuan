import { describe, expect, it } from 'vitest';
import { ClientErrorBuffer, type TelemetryScope } from './ClientErrors';

const tenant: TelemetryScope = { kind: 'tenant', id: 'tenant:one', tenant: 'tenant:one', path: [{ kind: 'platform', id: 'platform' }] };
const mall: TelemetryScope = { kind: 'mall', id: 'mall:one', tenant: 'tenant:one', path: [{ kind: 'platform', id: 'platform' }, tenant] };

describe('ClientErrorBuffer', () => {
  it('deduplicates, redacts and keeps a stable fault code', () => {
    const written: Readonly<Record<string, unknown>>[] = [];
    const buffer = new ClientErrorBuffer((record) => {
      written.push(record);
    });
    const input = clientError();
    const first = buffer.record(input);
    const second = buffer.record(input);
    expect(second.faultCode).toBe(first.faultCode);
    expect(second.occurrences).toBe(2);
    expect(second.message).toBe('[REDACTED]');
    expect(second.stack).toBe('Bearer [REDACTED]');
    buffer.record(input);
    expect(written).toHaveLength(2);
    expect(written[0]).not.toHaveProperty('message');
    expect(written[0]).toHaveProperty('detailReference', `clienterror:${first.fingerprint}`);
    expect(second).toMatchObject({ route: '/orders', operation: 'order.orders.read', release: 'release:20260906', traceId: 'trace' });
  });

  it('filters records by the operator scope hierarchy', () => {
    const buffer = new ClientErrorBuffer(() => undefined);
    buffer.record(clientError({ message: 'failure' }));
    expect(buffer.list(tenant, 10)).toHaveLength(1);
    expect(buffer.list({ kind: 'tenant', id: 'tenant:two', tenant: 'tenant:two', path: [] }, 10)).toHaveLength(0);
  });

  it('expires old records and bounds memory', () => {
    let now = 0;
    const buffer = new ClientErrorBuffer(
      () => undefined,
      1,
      10,
      () => now
    );
    const input = clientError({ route: '/one', message: 'one' });
    buffer.record(input);
    buffer.record({ ...input, route: '/two' });
    expect(buffer.list(tenant, 10)).toHaveLength(1);
    now = 11;
    expect(buffer.list(tenant, 10)).toHaveLength(0);
  });

  it('uses deterministic sampling without losing the local aggregate', () => {
    const written: Readonly<Record<string, unknown>>[] = [];
    const buffer = new ClientErrorBuffer((record) => {
      written.push(record);
    }, 10, 100, () => 0, 0);
    buffer.record(clientError());
    expect(buffer.list(tenant, 10)).toHaveLength(1);
    expect(written).toHaveLength(0);
  });
});

function clientError(overrides: Partial<Parameters<ClientErrorBuffer['record']>[0]> = {}) {
  return {
    scope: mall,
    surface: 'console',
    route: '/orders',
    operation: 'order.orders.read',
    release: 'release:20260906',
    message: 'mobile 13800138000 mail a@b.com',
    stack: 'Bearer abc.def',
    componentStack: null,
    traceId: 'trace',
    actorId: 'actor',
    membershipId: 'membership',
    ...overrides,
  };
}
