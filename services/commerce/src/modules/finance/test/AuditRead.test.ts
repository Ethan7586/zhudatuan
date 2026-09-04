import { describe, expect, it, vi } from 'vitest';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { readHandlerContext } from '../../../test/HandlerFixture';
import { AuditReadHandler } from '../application/handler/AuditReadHandler';

const transaction = {} as ReadTransactionContext;
const facts = [{ id: 'journal:one', kind: 'journal' as const, label: '账本凭证', business_reference: 'order:one', state: 'posted', amount_minor: 100, currency: 'CNY', occurred_at: '2026-09-05T10:00:00.000Z', version: 1 }];
const events = [{ id: 'event:one', type: 'finance.entry.posted', eventVersion: 1, aggregateType: 'journal', aggregateId: 'journal:one', state: 'published' as const, occurredAt: '2026-09-05T10:00:01.000Z', traceId: 'trace:one' }];
const records = [{ id: 'audit:one', kind: 'command' as const, operation: 'finance.post', subject: { type: 'member', id: 'actor:one' },
  object: { type: 'journal', id: 'journal:one' }, actor: { type: 'member', id: 'actor:one' }, request: 'request:one',
  outcome: 'succeeded' as const, reason: 'http:200', beforeHash: null, afterHash: 'a'.repeat(64), previousHash: null,
  recordHash: 'b'.repeat(64), evidence: {}, occurredAt: '2026-09-05T10:00:02.000Z', trace: 'trace:one' }];

describe('finance audit read', () => {
  it('composes scoped Finance facts, Runtime source events and immutable Audit evidence', async () => {
    const projection = { read: vi.fn(async () => ({ facts, resources: ['journal:one', 'entry:one'] })) };
    const eventPort = { events: vi.fn(async () => events) };
    const auditPort = { records: vi.fn(async () => records) };
    const organizations = { descendants: vi.fn(async () => ['enterprise:one', 'mall:one']) };
    const handler = new AuditReadHandler(projection, organizations, eventPort, auditPort);

    const reply = await handler.execute({ query: { reference: ' order:one ' } } as never, readHandlerContext('finance.audit.read', transaction, 'enterprise:one'));

    expect(projection.read).toHaveBeenCalledWith(transaction, ['enterprise:one', 'mall:one'], 'order:one');
    expect(eventPort.events).toHaveBeenCalledWith(transaction, ['enterprise:one', 'mall:one'], ['journal:one', 'entry:one']);
    expect(auditPort.records).toHaveBeenCalledWith(transaction, {
      scopes: ['enterprise:one', 'mall:one'],
      references: [{ kind: 'object', id: 'journal:one' }, { kind: 'object', id: 'entry:one' }, { kind: 'trace', id: 'trace:one' }],
    });
    expect(reply.body).toMatchObject({ reference: 'order:one', facts, watermark: '2026-09-05T10:00:02.000Z' });
    expect(reply.body.events[0]).toMatchObject({ event_version: 1, aggregate_id: 'journal:one', trace_id: 'trace:one' });
    expect(reply.body.records[0]).toMatchObject({ resource_type: 'journal', record_hash: 'b'.repeat(64), trace_id: 'trace:one' });
  });

  it('fails closed when the reference has no fact in the authorized scope', async () => {
    const eventsRead = vi.fn();
    const auditRead = vi.fn();
    const handler = new AuditReadHandler(
      { read: vi.fn(async () => ({ facts: [], resources: [] })) },
      { descendants: vi.fn(async () => ['mall:one']) },
      { events: eventsRead },
      { records: auditRead }
    );

    await expect(handler.execute({ query: { reference: 'order:missing' } } as never, readHandlerContext('finance.audit.read', transaction))).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect(eventsRead).not.toHaveBeenCalled();
    expect(auditRead).not.toHaveBeenCalled();
  });
});
