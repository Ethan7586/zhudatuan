import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface RelayOutboxEvent {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly scope: string;
  readonly aggregate: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
}

export interface OutboxRelayPort {
  claim(context: WriteTransactionContext, input: Readonly<{ event: string; worker: string; prefix: string }>): Promise<RelayOutboxEvent | null>;
  complete(context: WriteTransactionContext, input: Readonly<{ event: string; worker: string; cursor: string }>): Promise<void>;
  fail(context: WriteTransactionContext, input: Readonly<{ event: string; worker: string; reason: string }>): Promise<void>;
}

export const OUTBOX_RELAY_PORT = publicPort<OutboxRelayPort>('runtime', 'outboxrelay');
