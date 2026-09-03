export type TicketState = 'open' | 'assigned' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketChannel = 'inapp' | 'wechat' | 'email' | 'sms';

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
  readonly slaRisk: 'normal' | 'risk' | 'overdue';
}

export interface TicketPage {
  readonly items: readonly Ticket[];
  readonly count: number;
  readonly nextCursor?: string;
}
