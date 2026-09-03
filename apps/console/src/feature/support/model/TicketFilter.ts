import type { TicketPriority, TicketState } from './Ticket';

export interface TicketFilter {
  readonly limit?: number;
  readonly cursor?: string;
  readonly ownership?: 'mine' | 'unassigned' | 'all';
  readonly states?: readonly TicketState[];
  readonly priorities?: readonly TicketPriority[];
  readonly agentId?: string;
  readonly skill?: string;
  readonly unread?: boolean | 'true' | 'false';
  readonly keyword?: string;
  readonly updatedAfter?: string;
  readonly updatedBefore?: string;
}

export function filterSignature(filter: TicketFilter): string {
  return JSON.stringify(Object.entries(filter).sort(([left], [right]) => left.localeCompare(right)));
}
