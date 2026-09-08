import { createTelemetry, type ClientErrorInput, type TelemetryScope } from '@shop/telemetry';
import { describe, expect, it } from 'vitest';
import { TelemetryClientErrorRepository } from './TelemetryClientErrorRepository';

describe('TelemetryClientErrorRepository', () => {
  it('scrubs PII and secrets before emitting a bounded log reference', () => {
    const logs: Readonly<Record<string, unknown>>[] = [];
    const repository = new TelemetryClientErrorRepository(
      createTelemetry((record) => {
        logs.push(record);
      })
    );
    const recorded = repository.record(input());
    expect(recorded.message).toBe('[REDACTED]');
    expect(recorded.stack).toBe('Bearer [REDACTED]');
    expect(logs[0]).toMatchObject({ route: 'consoleorders', operation: 'order.orders.read', release: '20260906.a1b2c3', detailReference: `clienterror:${recorded.fingerprint}` });
    expect(logs[0]).not.toHaveProperty('message');
    expect(logs[0]).not.toHaveProperty('stack');
  });

  it('rejects high-cardinality route, unknown operation and malformed release attributes', () => {
    const repository = new TelemetryClientErrorRepository(createTelemetry(() => undefined));
    expect(() => repository.record(input({ route: '/orders/order:random' }))).toThrow('CLIENT_ERROR_ROUTE_INVALID');
    expect(() => repository.record(input({ operation: 'order.unknown.read' }))).toThrow('CLIENT_ERROR_OPERATION_INVALID');
    expect(() => repository.record(input({ release: 'release with spaces' }))).toThrow('CLIENT_ERROR_RELEASE_INVALID');
  });
});

const scope: TelemetryScope = { kind: 'platform', id: 'platform', path: [] };

function input(overrides: Partial<ClientErrorInput> = {}): ClientErrorInput {
  return {
    scope,
    surface: 'console',
    route: 'consoleorders',
    operation: 'order.orders.read',
    release: '20260906.a1b2c3',
    message: '手机 13800138000，邮箱 user@example.com',
    stack: 'Bearer abc.def',
    componentStack: null,
    traceId: 'trace:one',
    actorId: 'actor:one',
    membershipId: 'membership:one',
    ...overrides,
  };
}
