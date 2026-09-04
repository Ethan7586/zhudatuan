import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
export interface RuntimeJobRecord { readonly id: string; readonly kind: string; readonly state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'; readonly processed: number; readonly total: number; readonly succeeded: number; readonly failed: number; readonly retryable: number; readonly updatedAt: string; }
export interface JobPort {
  create(context: WriteTransactionContext, input: Readonly<{ scope: string; owner: string; kind: string; queue: string; payload: Readonly<Record<string, unknown>>; idempotency: string; actor: string }>): Promise<RuntimeJobRecord>;
  read(context: ReadTransactionContext, id: string, scope: string, owner: string): Promise<RuntimeJobRecord | null>;
  find(context: ReadTransactionContext, scope: string, owner: string, kind: string, idempotency: string): Promise<RuntimeJobRecord | null>;
  progress(context: WriteTransactionContext, id: string, scope: string, owner: string, checkpoint: Readonly<Record<string, number>>): Promise<RuntimeJobRecord>;
}
export const JOB_PORT = publicPort<JobPort>('runtime', 'job');
