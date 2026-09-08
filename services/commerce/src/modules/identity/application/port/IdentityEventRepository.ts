import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';

export interface IdentityEventRepository {
  publish(
    context: ReadTransactionContext,
    type: string,
    aggregateType: 'invitation' | 'session' | 'challenge' | 'membership' | 'linkcase' | 'principal',
    aggregate: string,
    scope: string,
    trace: string,
    payload: Readonly<Record<string, unknown>>
  ): Promise<void>;
}
