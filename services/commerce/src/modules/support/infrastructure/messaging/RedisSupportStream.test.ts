import { describe, expect, it, vi } from 'vitest';
import { RedisSupportStream } from './RedisSupportStream';

const event = {
  id: 'outbox:one',
  type: 'support.message.sent',
  scopeId: 'mall:one',
  ticketId: 'ticket:one',
  conversationId: 'conversation:one',
  memberId: 'member:one',
  messageId: 'message:one',
  sequence: 2,
  version: 3,
  occurredAt: '2026-09-02T00:00:00.000Z',
} as const;

describe('RedisSupportStream', () => {
  it('publishes under the authoritative scope without plaintext', async () => {
    const append = vi.fn(async () => '1740-0');
    await expect(new RedisSupportStream({ append } as never).publish(event)).resolves.toBe('1740-0');
    expect(append).toHaveBeenCalledWith('mall:one', JSON.stringify(event));
    expect(JSON.stringify(append.mock.calls)).not.toContain('message body');
  });

  it('filters storefront events by member and conversation', async () => {
    const stream = new RedisSupportStream({
      read: async function* () {
        yield { id: '1-0', stream: 'mall:one', value: JSON.stringify({ ...event, memberId: 'member:other' }) };
        yield { id: '2-0', stream: 'mall:one', value: JSON.stringify(event) };
      },
    } as never);
    const received = [];
    for await (const value of stream.read({ scopes: ['mall:one'], member: 'member:one', storefront: true, conversation: 'conversation:one', cursor: null, signal: new AbortController().signal })) received.push(value);
    expect(received).toEqual([{ ...event, id: '2-0' }]);
  });

  it('fails closed if a stream adapter yields an event outside the authorized scopes', async () => {
    const stream = new RedisSupportStream({
      read: async function* () {
        yield { id: '1-0', stream: 'mall:foreign', value: JSON.stringify({ ...event, scopeId: 'mall:foreign' }) };
        yield { id: '2-0', stream: 'mall:one', value: JSON.stringify(event) };
      },
    } as never);
    const received = [];
    for await (const value of stream.read({ scopes: ['mall:one'], member: 'member:one', storefront: false, conversation: null, cursor: null, signal: new AbortController().signal })) received.push(value);
    expect(received).toEqual([{ ...event, id: '2-0' }]);
  });

  it('maps expired cursors to the public resync error', async () => {
    const stream = new RedisSupportStream({
      read: async function* () {
        throw new Error('SUPPORT_EVENT_CURSOR_EXPIRED');
      },
    } as never);
    const consume = async () => {
      for await (const _value of stream.read({ scopes: ['mall:one'], member: 'member:one', storefront: false, conversation: null, cursor: 'old', signal: new AbortController().signal })) void _value;
    };
    await expect(consume()).rejects.toThrow('SUPPORT_EVENT_CURSOR_EXPIRED');
  });

  it('validates an expired cursor before the HTTP stream commits', async () => {
    const validate = vi.fn(async () => {
      throw new Error('SUPPORT_EVENT_CURSOR_EXPIRED');
    });
    await expect(new RedisSupportStream({ validate } as never).validate(['mall:one'], 'old')).rejects.toThrow('SUPPORT_EVENT_CURSOR_EXPIRED');
    expect(validate).toHaveBeenCalledWith(['mall:one'], 'old');
  });
});
