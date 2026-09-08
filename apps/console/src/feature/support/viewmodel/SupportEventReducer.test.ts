import { describe, expect, it } from 'vitest';
import type { SupportEvent } from '../model/SupportEvent';
import type { Ticket } from '../model/Ticket';
import { acceptSupportEvent, emptyEventLedger, reconcileQueue } from './SupportEventReducer';

const ticket: Ticket = Object.freeze({
  id: 'case:1',
  priority: 'normal',
  state: 'open',
  assignedAgentId: null,
  assignedAgentName: null,
  responseDueAt: '2026-08-26T01:00:00Z',
  resolutionDueAt: '2026-08-27T00:00:00Z',
  createdAt: '2026-08-26T00:00:00Z',
  updatedAt: '2026-08-26T00:00:00Z',
  version: 2,
  conversationId: 'conversation:1',
  skill: 'general',
  memberId: 'member:1',
  orderId: null,
  channel: 'inapp',
  subject: '配送咨询',
  referenceType: null,
  referenceId: null,
  unreadCount: 0,
  slaRisk: 'normal',
});

const event = (overrides: Partial<SupportEvent> = {}): SupportEvent =>
  Object.freeze({
    id: 'event:1',
    type: 'support.ticket.closed',
    scopeId: 'mall:1',
    ticketId: ticket.id,
    conversationId: ticket.conversationId,
    version: 3,
    occurredAt: '2026-08-26T00:01:00Z',
    ...overrides,
  });

describe('SupportEventReducer', () => {
  it('deduplicates event ids and rejects aggregate version rollback', () => {
    const first = acceptSupportEvent(emptyEventLedger(), event());
    expect(first.accepted).toBe(true);
    expect(acceptSupportEvent(first.ledger, event()).accepted).toBe(false);
    expect(acceptSupportEvent(first.ledger, event({ id: 'event:2', version: 1 })).accepted).toBe(false);
  });

  it('deduplicates the same message identity at the same aggregate version', () => {
    const first = acceptSupportEvent(emptyEventLedger(), event({ id: 'event:message:1', type: 'support.message.sent', messageId: 'message:1' }));
    expect(first.accepted).toBe(true);
    expect(acceptSupportEvent(first.ledger, event({ id: 'event:message:2', type: 'support.message.sent', messageId: 'message:1' })).accepted).toBe(false);
  });

  it('updates only the affected ticket with authoritative event version', () => {
    const other = Object.freeze({ ...ticket, id: 'case:2' });
    const current = { pages: [{ items: [ticket, other], count: 2 }], pageParams: [undefined] };
    const next = reconcileQueue(current, event(), 'case:2');
    expect(next?.pages[0]?.items[0]).toMatchObject({ id: 'case:1', state: 'closed', version: 3 });
    expect(next?.pages[0]?.items[1]).toBe(other);
  });
});
