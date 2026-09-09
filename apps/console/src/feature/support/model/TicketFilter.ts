import type { OperationQueryFor } from '@shop/contract';
import type { TicketPriority, TicketState } from './Ticket';

type TicketQuery = OperationQueryFor<'SupportCasesReadInput'>;

export interface TicketFilter {
  readonly limit?: number;
  readonly cursor?: string;
  readonly ownership?: TicketQuery['ownership'];
  readonly states?: readonly TicketState[];
  readonly priorities?: readonly TicketPriority[];
  readonly agentId?: string;
  readonly skill?: string;
  readonly unread?: boolean | 'true' | 'false';
  readonly orderId?: string;
  readonly keyword?: string;
  readonly updatedAfter?: string;
  readonly updatedBefore?: string;
}

export const advancedTicketFilterKeys = ['skill', 'agentId', 'updatedAfter', 'updatedBefore', 'unread'] as const;

export function advancedTicketFilterCount(filter: TicketFilter): number {
  return advancedTicketFilterKeys.filter((key) => filter[key] !== undefined && filter[key] !== false && filter[key] !== '').length;
}

export function filterSignature(filter: TicketFilter): string {
  return JSON.stringify(Object.entries(filter).sort(([left], [right]) => left.localeCompare(right)));
}
