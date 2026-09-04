export interface SupportEvent {
  readonly id: string;
  readonly type:
    | 'support.message.sent'
    | 'support.ticket.updated'
    | 'support.ticket.assigned'
    | 'support.ticket.closed'
    | 'support.ticket.reopened'
    | 'support.readstate.updated'
    | 'support.attachment.ready'
    | 'support.attachment.rejected'
    | 'support.sla.escalated';
  readonly scopeId: string;
  readonly ticketId: string;
  readonly conversationId: string;
  readonly messageId?: string;
  readonly evidenceId?: string;
  readonly sequence?: number;
  readonly version?: number;
  readonly occurredAt: string;
}
