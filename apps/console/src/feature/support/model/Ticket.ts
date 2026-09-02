import type { OperationOutputFor } from '@shop/contract';

export type TicketPage = OperationOutputFor<'support.cases.read'>;
export type Ticket = TicketPage['items'][number];
export type TicketState = Ticket['state'];
export type TicketPriority = Ticket['priority'];
