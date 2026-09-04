import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { EventsReadHandler } from './EventsReadHandler';

const actor = { actor: 'actor:one', membership: 'membership:one', member: 'member:one', target: 'storefront', scope: 'mall:one', scopes: ['mall:one'], trace: 'trace:one' } as const;
const event = { id: '11-0', type: 'support.message.sent', scopeId: 'mall:one', ticketId: 'ticket:one', conversationId: 'conversation:one', memberId: 'member:one', sequence: 1, occurredAt: '2026-09-06T00:01:00.000Z' } as const;

describe('EventsReadHandler', () => {
  it('falls back to PostgreSQL before committing a stream when Redis trimmed the cursor', async () => {
    const replay = { replay: vi.fn(async () => ({ events: [event], resumeCursor: '12-0' })) };
    const handler = new EventsReadHandler(
      { actor: vi.fn(async () => actor) } as never,
      { validate: vi.fn(async () => { throw new DomainError('SUPPORT_EVENT_CURSOR_EXPIRED'); }) } as never,
      replay as never,
      { present: vi.fn() } as never
    );
    const loaded = await handler.load({ query: { conversationId: 'conversation:one' } } as never, { transaction: {}, headers: { 'last-event-id': '10-0' } } as never);
    expect(loaded).toMatchObject({ cursor: '12-0', replay: [event] });
    expect(replay.replay).toHaveBeenCalledWith(expect.anything(), { scopes: ['mall:one'], member: 'member:one', storefront: true, conversation: 'conversation:one', cursor: '10-0' });
  });
});
