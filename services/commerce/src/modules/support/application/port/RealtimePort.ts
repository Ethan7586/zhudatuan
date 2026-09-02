export interface SupportRealtimeEvent {
  readonly id: string;
  readonly type: 'support.message.sent' | 'support.ticket.updated' | 'support.ticket.assigned' | 'support.ticket.closed' | 'support.ticket.reopened' | 'support.readstate.updated' | 'support.attachment.ready' | 'support.attachment.rejected' | 'support.sla.escalated';
  readonly scopeId: string;
  readonly ticketId: string;
  readonly conversationId: string;
  readonly memberId?: string | null;
  readonly messageId?: string;
  readonly evidenceId?: string;
  readonly sequence?: number;
  readonly version?: number;
  readonly occurredAt: string;
}

export interface RealtimePort {
  publish(event: SupportRealtimeEvent): Promise<string>;
  validate(scopes: readonly string[], cursor: string | null): Promise<void>;
  read(input: Readonly<{ scopes: readonly string[]; member: string; storefront: boolean; conversation: string | null; cursor: string | null; signal: AbortSignal }>): AsyncIterable<SupportRealtimeEvent>;
}

export interface SupportStreamPresenter {
  present(input: Readonly<{
    scopes: readonly string[];
    member: string;
    storefront: boolean;
    conversation: string | null;
    cursor: string | null;
    release: () => void;
  }>): OperationReply<OperationOutputFor<'support.events.read'>>;
}
import type { OperationOutputFor } from '@shop/contract';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
