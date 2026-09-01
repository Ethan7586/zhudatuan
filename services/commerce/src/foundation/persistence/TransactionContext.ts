const transactionBrand: unique symbol = Symbol('TransactionContext');

export type TransactionMode = 'read' | 'write';

export interface TransactionContext<TMode extends TransactionMode> {
  readonly [transactionBrand]: TMode;
  readonly id: string;
  readonly mode: TMode;
  readonly tenant: string;
  readonly membership: string;
  readonly scope: string;
  readonly actor: string;
  readonly trace: string;
  readonly operation: string;
  readonly deadline: number;
  readonly signal: AbortSignal;
}

export type ReadTransactionContext = TransactionContext<'read'> | TransactionContext<'write'>;
export type WriteTransactionContext = TransactionContext<'write'>;

export function requireWriteTransaction(context: ReadTransactionContext): WriteTransactionContext {
  if (context.mode !== 'write') throw new Error('WRITE_TRANSACTION_CONTEXT_REQUIRED');
  return context;
}
