import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface RestockLine {
  readonly line: string;
  readonly sku: string;
  readonly quantity: number;
}

export interface RestockRequest {
  readonly id: string;
  readonly scope: string;
  readonly location: string | null;
  readonly lines: readonly RestockLine[];
}

export interface RestockRepository {
  apply(context: WriteTransactionContext, request: RestockRequest): Promise<void>;
}
