import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

export interface ExtensionStateSink {
  degrade(context: ReadTransactionContext, id: string, scope: string): Promise<void>;
  recover(context: ReadTransactionContext, id: string, scope: string): Promise<void>;
}
