import type { OperationId } from '@shop/contract';
import type { OperationReply } from './OperationHandler';
import type { WriteTransactionContext } from '../persistence/TransactionContext';

export interface IdempotencyClaim {
  readonly scope: string;
  readonly actor: string;
  readonly operation: OperationId;
  readonly key: string;
  readonly requestHash: string;
}

export type IdempotencyState = Readonly<{ state: 'started' }> | Readonly<{ state: 'checkpointed' | 'completed'; response: OperationReply<unknown> }>;

export interface IdempotencyRepository {
  claim(context: WriteTransactionContext, claim: IdempotencyClaim): Promise<IdempotencyState>;
  checkpoint(context: WriteTransactionContext, claim: IdempotencyClaim, response: OperationReply<unknown>): Promise<void>;
  complete(context: WriteTransactionContext, claim: IdempotencyClaim, response: OperationReply<unknown>): Promise<void>;
}
