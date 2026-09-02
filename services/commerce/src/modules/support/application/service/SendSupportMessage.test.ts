import { describe, expect, it, vi } from 'vitest';
import { Ticket } from '../../domain/model/Ticket';
import { SendSupportMessage } from './SendSupportMessage';

const actor = { actor: 'actor:agent', membership: 'membership:agent', member: 'member:agent', target: 'console', scope: 'mall:one', scopes: ['mall:one'], trace: 'trace:one' } as const;
const target = { ticket: new Ticket('ticket:one', 'conversation:one', 'mall:one', 'normal', 'assigned', 3), conversation: 'conversation:one', conversationVersion: 5, member: 'member:one', assignedAgent: 'agent:one' } as const;
const stored = { id: 'message:one', clientMessageId: 'client:0001', conversationId: 'conversation:one', authorType: 'agent', authorId: 'actor:agent', bodyHash: 'f'.repeat(64), sequence: 6, version: 1, createdAt: '2026-09-02T00:00:00.000Z' } as const;

describe('SendSupportMessage', () => {
  it('locks, versions, appends and publishes one encrypted agent message', async () => {
    const values = fixture(null);
    const service = values.service;
    const input = request(); const execution = { expectedVersion: 3, traceId: 'trace:one' } as never;
    const loaded = await service.loadMessage({} as never, input, execution);
    const prepared = await service.prepareMessage(input, execution, loaded);
    const response = await service.sendMessage({} as never, input, execution, prepared);
    expect(response).toMatchObject({ status: 201, headers: { etag: '"4"' }, body: { message: { body: '已受理', sequence: 6 }, ticket: { state: 'waiting', version: 4 }, conversationVersion: 6 } });
    expect(values.messages.append).toHaveBeenCalledOnce();
    expect(values.events.history).toHaveBeenCalledOnce();
    expect(values.events.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'support.message.sent', payload: expect.objectContaining({ sequence: 6 }) }));
  });

  it('returns the existing message for the same client id without advancing sequence', async () => {
    const values = fixture(stored);
    const input = request(); const execution = { expectedVersion: 3, traceId: 'trace:one' } as never;
    const loaded = await values.service.loadMessage({} as never, input, execution);
    const prepared = await values.service.prepareMessage(input, execution, loaded);
    const response = await values.service.sendMessage({} as never, input, execution, prepared);
    expect(response.body.message).toMatchObject({ id: 'message:one', clientMessageId: 'client:0001', body: '已受理' });
    expect(values.conversations.advance).not.toHaveBeenCalled();
    expect(values.messages.append).not.toHaveBeenCalled();
  });

  it('rejects a stale ticket version before any append', async () => {
    const values = fixture(null);
    const input = request(); const execution = { expectedVersion: 2, traceId: 'trace:one' } as never;
    const loaded = await values.service.loadMessage({} as never, input, execution);
    const prepared = await values.service.prepareMessage(input, execution, loaded);
    await expect(values.service.sendMessage({} as never, input, execution, prepared)).rejects.toThrow('VERSION_CONFLICT');
    expect(values.messages.append).not.toHaveBeenCalled();
  });

  it('fails before the write transaction when KMS is unavailable and leaves no partial message', async () => {
    const values = fixture(null, { encrypt: vi.fn(async () => { throw new Error('KMS_UNAVAILABLE'); }) });
    const input = request(); const execution = { expectedVersion: 3, traceId: 'trace:one' } as never;
    const loaded = await values.service.loadMessage({} as never, input, execution);
    await expect(values.service.prepareMessage(input, execution, loaded)).rejects.toThrow('KMS_UNAVAILABLE');
    expect(values.messages.append).not.toHaveBeenCalled();
    expect(values.conversations.advance).not.toHaveBeenCalled();
    expect(values.events.append).not.toHaveBeenCalled();
  });
});

function fixture(existing: typeof stored | null, kms = { encrypt: vi.fn(async () => ({ ciphertext: 'encrypted-message', fingerprint: 'f'.repeat(64), keyVersion: 'v1' })) }) {
  const messages = { existing: vi.fn(async () => existing), append: vi.fn(async () => stored) };
  const conversations = { advance: vi.fn(async () => ({ sequence: 6, version: 6 })) };
  const events = { history: vi.fn(), append: vi.fn() };
  const service = new SendSupportMessage(
    kms as never,
    { actor: vi.fn(async () => actor) } as never,
    { readMessageTarget: vi.fn(async () => target), lockMessageTarget: vi.fn(async () => target), advanceMessage: vi.fn(async () => ({ id: 'ticket:one', state: 'waiting', version: 4 })) } as never,
    conversations as never,
    messages as never,
    { assertReady: vi.fn() } as never,
    { assertSender: vi.fn() } as never,
    events as never
  );
  return { service, messages, conversations, events };
}

function request() { return { path: { caseid: 'ticket:one' }, body: { message: ' 已受理 ', clientMessageId: 'client:0001' } } as never; }
