import { describe, expect, it, vi } from 'vitest';
import { result, withReadTransaction, withWriteTransaction } from '../../../../test/TransactionFixture';
import type { EventReplayPort, RuntimeReplayEvent } from '../../../runtime/public';
import { PgSupportReplayRepository } from './PgSupportReplayRepository';

const durable = { id: 'event:two', type: 'support.message.sent', version: 1, scope: 'mall:one', aggregate: 'conversation:one', payload: { messageId: 'message:two', sequence: 99, version: 5, memberId: 'member:one' }, occurredAt: '2026-09-06T00:02:00.000Z' } as const;

describe('PgSupportReplayRepository', () => {
  it('uses the persisted message sequence and hides internal system traffic from members', async () => {
    const query = vi.fn(async (sql: string) => sql.includes('where message.id=$1')
      ? result([{ message_id: 'message:two', ticket_id: 'ticket:one', conversation_id: 'conversation:one', member_id: 'member:one', sequence: 2, visibility: 'internal' }])
      : result([]));
    const event = await withWriteTransaction(query, (context) => new PgSupportReplayRepository(runtime()).authoritative(context, durable));
    expect(event).toMatchObject({ sequence: 2, ticketId: 'ticket:one', conversationId: 'conversation:one' });
    expect(event).not.toHaveProperty('memberId');
  });

  it('replays persisted events in message order and advances the Redis resume cursor across filtered rows', async () => {
    const events = [row('event:two', '12-0', 2), row('event:one', '11-0', 1), row('event:internal', '13-0', 3)];
    const query = vi.fn(async () => result([
      truth('message:2', 2, 'external'),
      truth('message:1', 1, 'external'),
      truth('message:3', 3, 'internal'),
    ]));
    const batch = await withReadTransaction(query, (context) => new PgSupportReplayRepository(runtime(events)).replay(context, { scopes: ['mall:one'], member: 'member:one', storefront: true, conversation: 'conversation:one', cursor: '10-0' }));
    expect(batch.events.map(({ sequence }) => sequence)).toEqual([1, 2]);
    expect(batch.resumeCursor).toBe('13-0');
  });
});

function row(id: string, cursor: string, sequence: number): RuntimeReplayEvent {
  return { id, type: 'support.message.sent', version: 1, scope: 'mall:one', aggregate: 'conversation:one', payload: { messageId: `message:${sequence}`, version: sequence }, occurredAt: `2026-09-06T00:0${sequence}:00.000Z`, cursor };
}

function truth(message: string, sequence: number, visibility: 'external' | 'internal') {
  return { message_id: message, ticket_id: 'ticket:one', conversation_id: 'conversation:one', member_id: 'member:one', sequence, visibility };
}

function runtime(events: readonly RuntimeReplayEvent[] = []): EventReplayPort {
  return {
    after: async () => ({ events, resumeCursor: events.at(-1)?.cursor ?? null, overflow: false }),
    publishedReferences: async () => Object.freeze([]),
  };
}
