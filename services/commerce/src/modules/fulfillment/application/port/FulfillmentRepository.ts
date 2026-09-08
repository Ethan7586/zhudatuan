import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface FulfillmentRepository {
  ship(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      scope: string;
      actor: string;
      trace: string;
      idempotency: string;
      tracking: string;
      carrier: string | null;
      expectedVersion: number;
      lines: readonly Readonly<{ line: string; quantity: number }>[] | null;
    }>
  ): Promise<Readonly<Record<string, unknown>>>;
}
