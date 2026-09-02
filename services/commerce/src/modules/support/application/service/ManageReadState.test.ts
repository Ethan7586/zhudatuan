import { describe, expect, it, vi } from 'vitest';
import { ReadState } from '../../domain/model/ReadState';
import { ManageReadState } from './ManageReadState';

describe('ManageReadState', () => {
  it('uses the authenticated membership and publishes no message content', async () => {
    const actor = { actor: 'actor:one', membership: 'membership:one', member: 'member:one', target: 'storefront', scope: 'mall:one', scopes: ['mall:one'], trace: 'trace:one' } as const;
    const readstates = { advance: vi.fn(async () => ({ state: new ReadState('conversation:one', 'membership:one', 9, 3), ticket: 'ticket:one', scope: 'mall:one' })) };
    const events = { append: vi.fn() };
    const service = new ManageReadState({ actor: vi.fn(async () => actor) } as never, readstates as never, events as never);
    const response = await service.manageReadState({} as never, { path: { conversationid: 'conversation:one' }, body: { lastSequence: 9 } } as never, { traceId: 'trace:one' } as never);
    expect(readstates.advance).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ membership: 'membership:one', member: 'member:one', storefront: true, lastSequence: 9 }));
    expect(response.body).toEqual({ conversationId: 'conversation:one', lastSequence: 9, version: 3 });
    expect(events.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'support.readstate.updated', payload: { ticketId: 'ticket:one', conversationId: 'conversation:one', memberId: 'member:one', sequence: 9, version: 3 } }));
  });
});
