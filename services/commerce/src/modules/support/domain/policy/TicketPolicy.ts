import { DomainError } from '../../../../foundation/domain/DomainError';
import type { Ticket } from '../model/Ticket';

export class TicketPolicy {
  assertVersion(ticket: Ticket, expected: number | undefined): void {
    if (expected === undefined || ticket.version !== expected) throw new DomainError('VERSION_CONFLICT');
  }

  assertWritable(ticket: Ticket, author: 'member' | 'agent'): void {
    if (ticket.state === 'closed') throw new DomainError('SUPPORT_TICKET_NOT_WRITABLE');
    if (author === 'agent' && ticket.state === 'resolved') throw new DomainError('SUPPORT_TICKET_NOT_WRITABLE');
  }

  assertParticipant(ticket: Ticket, author: 'member' | 'agent', participant: string, member: string | null): void {
    if (author === 'agent') ticket.assertAgent(participant);
    else if (!member || participant !== member) throw new DomainError('SUPPORT_TICKET_NOT_WRITABLE');
  }
}
