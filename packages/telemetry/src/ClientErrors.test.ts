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
    const input = { scope: mall, surface: 'console', route: '/orders', message: 'mobile 13800138000 mail a@b.com', stack: 'Bearer abc.def', componentStack: null, traceId: 'trace', actorId: 'actor', membershipId: 'membership' };
    const first = buffer.record(input);
    const second = buffer.record(input);
    expect(second.faultCode).toBe(first.faultCode);
    expect(second.occurrences).toBe(2);
    expect(second.message).toBe('[REDACTED]');
    expect(second.stack).toBe('Bearer [REDACTED]');
    expect(written).toHaveLength(2);
  });

  it('filters records by the operator scope hierarchy', () => {
    const buffer = new ClientErrorBuffer(() => undefined);
    buffer.record({ scope: mall, surface: 'console', route: '/orders', message: 'failure', stack: null, componentStack: null, traceId: 'trace', actorId: 'actor', membershipId: 'membership' });
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
    const input = { scope: mall, surface: 'console', route: '/one', message: 'one', stack: null, componentStack: null, traceId: 'trace', actorId: 'actor', membershipId: 'membership' };
    buffer.record(input);
    buffer.record({ ...input, route: '/two' });
    expect(buffer.list(tenant, 10)).toHaveLength(1);
    now = 11;
    expect(buffer.list(tenant, 10)).toHaveLength(0);
  });
});
