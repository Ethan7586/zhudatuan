import { describe, expect, it, vi } from 'vitest';
import { RelaySupportEvents } from './RelaySupportEvents';

const execution = { scope: 'mall:one', trace: 'trace:relay', signal: new AbortController().signal, deadline: Date.now() + 10_000 } as const;
const event = {
  id: 'event:one',
  type: 'support.message.sent',
  version: 1,
  scope: 'mall:one',
  aggregate: 'ticket:one',
  payload: { ticketId: 'ticket:one', conversationId: 'conversation:one', memberId: 'member:one', messageId: 'message:one', sequence: 7, version: 4 },
  occurredAt: '2026-09-02T00:00:00.000Z',
} as const;
const realtimeEvent = {
  id: 'event:one',
  type: 'support.message.sent',
  scopeId: 'mall:one',
  ticketId: 'ticket:one',
  conversationId: 'conversation:one',
  memberId: 'member:one',
  messageId: 'message:one',
  sequence: 7,
  version: 4,
  occurredAt: '2026-09-02T00:00:00.000Z',
} as const;

describe('RelaySupportEvents', () => {
  it('publishes only the lightweight event then checkpoints the cursor', async () => {
    const outbox = { claim: vi.fn(async () => event), complete: vi.fn(), fail: vi.fn() };
    const realtime = { publish: vi.fn(async () => '1740-0') };
    await new RelaySupportEvents(transactions() as never, outbox as never, realtime as never, authority() as never).execute('event:one', execution);
    expect(realtime.publish).toHaveBeenCalledWith(realtimeEvent);
    expect(outbox.complete).toHaveBeenCalledWith(expect.anything(), { event: 'event:one', cursor: '1740-0', worker: 'trace:relay' });
  });

  it('records a retryable failure without marking the outbox event complete', async () => {
    const outbox = { claim: vi.fn(async () => event), complete: vi.fn(), fail: vi.fn() };
    const relay = new RelaySupportEvents(
      transactions() as never,
      outbox as never,
      {
        publish: vi.fn(async () => {
          throw new Error('REDIS_UNAVAILABLE');
        }),
      } as never,
      authority() as never
    );
    await expect(relay.execute('event:one', execution)).rejects.toThrow('REDIS_UNAVAILABLE');
    expect(outbox.fail).toHaveBeenCalledWith(expect.anything(), { event: 'event:one', worker: 'trace:relay', reason: 'REDIS_UNAVAILABLE' });
    expect(outbox.complete).not.toHaveBeenCalled();
  });
});

function transactions() {
  return { write: vi.fn(async (_options, work) => work({})) };
}
function authority() {
  return { authoritative: vi.fn(async () => realtimeEvent) };
}
