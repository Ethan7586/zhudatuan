import type { OperationOutputFor } from '@shop/contract';

type TicketDto = OperationOutputFor<'support.cases.read'>['items'][number];
export type TicketState = TicketDto['state'];
export type TicketPriority = TicketDto['priority'];
export type TicketChannel = TicketDto['channel'];

export interface Ticket {
  readonly id: string;
  readonly priority: TicketPriority;
  readonly state: TicketState;
  readonly assignedAgentId: string | null;
  readonly responseDueAt: string;
  readonly resolutionDueAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
  readonly conversationId: string;
  readonly skill: string;
  readonly memberId: string | null;
  readonly orderId: string | null;
  readonly channel: TicketChannel;
  readonly subject: string;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly unreadCount: number;
  readonly slaRisk: TicketDto['sla_risk'];
}

export interface TicketPage {
  readonly items: readonly Ticket[];
  readonly count: number;
  readonly nextCursor?: string;
}
