import { describe, expect, it, vi } from 'vitest';
import { RuntimeEventPublisher } from './RuntimeEventPublisher';

describe('RuntimeEventPublisher', () => {
  it('types polymorphic event parameters and enqueues the declared handler', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => sql.includes('runtime.accept_inbox')
      ? { rows: [{ inserted: true }], rowCount: 1 }
      : { rows: [], rowCount: 1 });
    const client = { query, release: vi.fn() };
    const pool = { connect: vi.fn(async () => client) };
    await new RuntimeEventPublisher(pool as never).publish({
      id: 'event:1', event_type: 'order.placed', event_version: 1, aggregate_id: 'order:1', scope_id: 'mall:1',
      payload: Object.freeze({ order: 'order:1' }), trace_id: 'trace:1', attempts: 1,
    });

    const enqueue = query.mock.calls.find(([sql]) => sql.includes('insert into runtime.job'));
    expect(enqueue?.[0]).toContain("'eventId',$4::text,'event',$5::text");
    expect(enqueue?.[1]?.slice(1)).toEqual(['projection', 'mall:1', 'event:1', 'order.placed', '{"order":"order:1"}']);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
