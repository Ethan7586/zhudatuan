import type { InfiniteData } from '@tanstack/react-query';
import type { UploadedAttachment } from '../model/Message';
import type { SupportEvent } from '../model/SupportEvent';
import type { Ticket, TicketPage } from '../model/Ticket';

export interface SupportEventLedger {
  readonly ids: readonly string[];
  readonly versions: Readonly<Record<string, number>>;
  readonly messages: Readonly<Record<string, number>>;
}

export const emptyEventLedger = (): SupportEventLedger => Object.freeze({ ids: Object.freeze([]), versions: Object.freeze({}), messages: Object.freeze({}) });

export function acceptSupportEvent(ledger: SupportEventLedger, event: SupportEvent): Readonly<{ ledger: SupportEventLedger; accepted: boolean }> {
  if (ledger.ids.includes(event.id)) return Object.freeze({ ledger, accepted: false });
  const known = ledger.versions[event.ticketId] ?? 0;
  if (event.version !== undefined && event.version < known) return Object.freeze({ ledger, accepted: false });
  const messageVersion = event.messageId ? (ledger.messages[event.messageId] ?? 0) : 0;
  if (event.messageId && event.version !== undefined && event.version <= messageVersion) return Object.freeze({ ledger, accepted: false });
  const ids = [...ledger.ids.slice(-499), event.id];
  const versions = event.version === undefined ? ledger.versions : { ...ledger.versions, [event.ticketId]: Math.max(known, event.version) };
  const messages = !event.messageId || event.version === undefined ? ledger.messages : { ...ledger.messages, [event.messageId]: event.version };
  return Object.freeze({ ledger: Object.freeze({ ids: Object.freeze(ids), versions: Object.freeze(versions), messages: Object.freeze(messages) }), accepted: true });
}

export function reconcileQueue(current: InfiniteData<TicketPage, string | undefined> | undefined, event: SupportEvent, selected?: string): InfiniteData<TicketPage, string | undefined> | undefined {
  if (!current) return current;
  return {
    ...current,
    pages: current.pages.map((page) => Object.freeze({
      ...page,
      items: Object.freeze(page.items.map((ticket) => (ticket.id === event.ticketId ? reconcileTicket(ticket, event, selected) : ticket))),
    })),
  };
}

export function reconcileUploads(current: readonly UploadedAttachment[], event: SupportEvent): readonly UploadedAttachment[] {
  if (!event.evidenceId || (event.type !== 'support.attachment.ready' && event.type !== 'support.attachment.rejected')) return current;
  return Object.freeze(current.map((item) => (item.id === event.evidenceId ? Object.freeze({ ...item, state: event.type === 'support.attachment.ready' ? 'clean' as const : 'rejected' as const }) : item)));
}

function reconcileTicket(ticket: Ticket, event: SupportEvent, selected?: string): Ticket {
  const version = Math.max(ticket.version, event.version ?? ticket.version);
  const unreadCount = event.type === 'support.message.sent' && event.ticketId !== selected ? ticket.unreadCount + 1 : ticket.unreadCount;
  const state = event.type === 'support.ticket.closed' ? 'closed' : event.type === 'support.ticket.reopened' ? 'open' : event.type === 'support.ticket.assigned' ? 'assigned' : ticket.state;
  const slaRisk = event.type === 'support.sla.escalated' ? 'overdue' : ticket.slaRisk;
  return Object.freeze({ ...ticket, state, slaRisk, updatedAt: event.occurredAt, version, unreadCount });
}
