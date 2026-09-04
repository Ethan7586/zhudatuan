import { describe, expect, it, vi } from 'vitest';
import { RuntimeEventPublisher } from './RuntimeEventPublisher';
import { EventRegistry } from '../../bootstrap/EventRegistry';

describe('RuntimeEventPublisher', () => {
  it('types polymorphic event parameters and enqueues the declared handler', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => sql.includes('runtime.accept_inbox')
      ? { rows: [{ inserted: true }], rowCount: 1 }
      : sql.includes('select exists(select 1 from runtime.jobs') ? { rows: [{ existing: false, depth: 0 }], rowCount: 1 } : { rows: [], rowCount: 1 });
    const client = { query, release: vi.fn() };
    const pool = { connect: vi.fn(async () => client), query, workload: () => pool, end: vi.fn() };
    const events = new EventRegistry();
    events.declare('order.received');
    events.subscribe('order.received', 'projection');
    events.freeze();
    await new RuntimeEventPublisher(pool as never, events).publish(
      {
        id: 'event:1',
        event_type: 'order.received',
        event_version: 1,
        aggregate_id: 'order:1',
        aggregate_version: 1,
        scope_id: 'mall:1',
        actor_id: 'member:1',
        correlation_id: 'correlation:1',
        causation_id: 'command:1',
        payload_version: 1,
        payload: Object.freeze({ orderId: 'order:1', receivedAt: '2026-08-30T00:00:00.000Z', fulfillmentState: 'received' }),
        trace_id: 'trace:1',
        attempts: 1,
        fencing_token: 1,
      },
      new AbortController().signal,
      Date.now() + 10_000
    );

    const enqueue = query.mock.calls.find(([sql]) => sql.includes('insert into runtime.job'));
    expect(enqueue?.[0]).toContain("'eventId',$4::text,'event',$5::text");
    expect(enqueue?.[1]).toEqual([
      expect.stringMatching(/^job:/),
      'projection',
      'mall:1',
      'event:1',
      'order.received',
      '{"orderId":"order:1","receivedAt":"2026-08-30T00:00:00.000Z","fulfillmentState":"received"}',
      'order:1',
      1,
      'member:1',
      'correlation:1',
      'command:1',
      1,
      'reporting',
      'projection',
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('publishes a declared event with no subscribers without creating a fake job', async () => {
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => ({ rows: [], rowCount: 1 }));
    const client = { query, release: vi.fn() };
    const pool = { connect: vi.fn(async () => client), query, workload: () => pool, end: vi.fn() };
    const events = new EventRegistry();
    events.declare('identity.challenge.started');
    events.freeze();

    await new RuntimeEventPublisher(pool as never, events).publish(
      {
        id: 'event:challenge',
        event_type: 'identity.challenge.started',
        event_version: 1,
        aggregate_id: 'challenge:1',
        aggregate_version: 1,
        scope_id: 'identity',
        actor_id: 'public:identity',
        correlation_id: 'correlation:1',
        causation_id: 'command:1',
        payload_version: 1,
        payload: Object.freeze({ challenge: 'challenge:1', purpose: 'login' }),
        trace_id: 'trace:1',
        attempts: 1,
        fencing_token: 1,
      },
      new AbortController().signal,
      Date.now() + 10_000
    );

    expect(query).toHaveBeenCalledWith('begin isolation level serializable');
    expect(query).toHaveBeenCalledWith('commit');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('insert into runtime.job'))).toBe(false);
  });
});
