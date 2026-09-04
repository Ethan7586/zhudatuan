import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface ExtensionStateSink {
  degrade(context: ReadTransactionContext, id: string, scope: string): Promise<void>;
  recover(context: ReadTransactionContext, id: string, scope: string): Promise<void>;
}
