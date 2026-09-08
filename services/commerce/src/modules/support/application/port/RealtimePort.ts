export interface SupportRealtimeEvent {
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

export interface DurableSupportEvent {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly scope: string;
  readonly aggregate: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
}

export interface SupportReplayBatch {
  readonly events: readonly SupportRealtimeEvent[];
  readonly resumeCursor: string | null;
}

export interface SupportReplayPort {
  authoritative(context: WriteTransactionContext, event: DurableSupportEvent): Promise<SupportRealtimeEvent>;
  replay(context: ReadTransactionContext, input: Readonly<{ scopes: readonly string[]; member: string; storefront: boolean; conversation: string | null; cursor: string }>): Promise<SupportReplayBatch>;
}

export interface SupportStreamPresenter {
  present(
    input: Readonly<{
      scopes: readonly string[];
      member: string;
      storefront: boolean;
      conversation: string | null;
      cursor: string | null;
      replay: readonly SupportRealtimeEvent[];
      release: () => void;
    }>
  ): OperationReply<OperationOutputFor<'support.events.read'>>;
}
import type { OperationOutputFor } from '@shop/contract';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
