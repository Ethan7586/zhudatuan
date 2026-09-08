import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

export interface RuntimeEventEvidence {
  readonly id: string;
  readonly type: string;
  readonly eventVersion: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly state: 'pending' | 'published' | 'failed';
  readonly occurredAt: string;
  readonly traceId: string;
}

export interface EventEvidenceReadPort {
  events(context: ReadTransactionContext, scopes: readonly string[], resources: readonly string[]): Promise<readonly RuntimeEventEvidence[]>;
}

export const EVENT_EVIDENCE_READ_PORT = publicPort<EventEvidenceReadPort>('runtime', 'eventevidence');
