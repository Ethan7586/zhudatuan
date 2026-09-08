import type { QueryPage } from '../../../../pipeline/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { FulfillmentAction, FulfillmentStatus } from '../../domain/model/FulfillmentState';

export interface StoreWorkRepository {
  work(context: ReadTransactionContext, scope: string, states: readonly FulfillmentStatus[], page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  returns(context: ReadTransactionContext, scope: string, states: readonly string[], page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  transition(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      scope: string;
      actor: string;
      trace: string;
      idempotency: string;
      expectedVersion: number;
      action: Extract<FulfillmentAction, 'accept' | 'progress' | 'ready' | 'complete'>;
      note: string | null;
    }>
  ): Promise<Readonly<Record<string, unknown>>>;
}
