import type { DomainEvent } from '../domain/DomainEvent';
import type { WriteTransactionContext } from '../persistence/TransactionContext';

export interface OutboxMessage {
  readonly id: string;
  readonly event_type: string;
  readonly event_version: number;
  readonly aggregate_id: string;
  readonly aggregate_version: number;
  readonly scope_id: string;
  readonly actor_id: string;
  readonly correlation_id: string;
  readonly causation_id: string;
  readonly payload_version: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly trace_id: string;
  readonly attempts: number;
  readonly fencing_token: number;
}

export interface OutboxWriter {
  append(context: WriteTransactionContext, event: DomainEvent): Promise<void>;
}

export interface EventPublisher {
  publish(event: OutboxMessage, signal: AbortSignal, deadline: number): Promise<void>;
}
