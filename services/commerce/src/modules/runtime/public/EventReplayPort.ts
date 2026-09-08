import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

export interface RuntimeReplayEvent {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly scope: string;
  readonly aggregate: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
  readonly cursor: string;
}

export interface RuntimeReplayPage {
  readonly events: readonly RuntimeReplayEvent[];
  readonly resumeCursor: string | null;
  readonly overflow: boolean;
}

export interface EventReplayPort {
  after(context: ReadTransactionContext, input: Readonly<{ cursor: string; scopes: readonly string[]; prefix: string; limit: number }>): Promise<RuntimeReplayPage | null>;
  publishedReferences(context: ReadTransactionContext, input: Readonly<{ type: string; field: string; references: readonly string[]; excluding: string | null }>): Promise<readonly string[]>;
}

export const EVENT_REPLAY_PORT = publicPort<EventReplayPort>('runtime', 'eventreplay');
