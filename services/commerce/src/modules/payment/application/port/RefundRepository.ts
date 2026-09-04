import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface RefundRequest {
  readonly id: string;
  readonly payment: string;
  readonly amountMinor: number;
  readonly idempotency: string;
  readonly reason: string;
  readonly scope: string;
  readonly actor: string;
  readonly expectedVersion: number;
}

export interface RefundRepository {
  create(context: WriteTransactionContext, input: RefundRequest): Promise<Readonly<Record<string, unknown>>>;
}
