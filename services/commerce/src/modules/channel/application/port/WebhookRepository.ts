import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface WebhookConnection {
  readonly provider: string;
  readonly scope: string;
  readonly status: string;
}

export interface WebhookRepository {
  connection(context: ReadTransactionContext, id: string): Promise<WebhookConnection>;
  accept(
    context: WriteTransactionContext,
    input: Readonly<{
      connection: string;
      external: string;
      ciphertext: string;
      keyVersion: string;
      rawHash: string;
      signatureHash: string;
      receivedAt: string;
      trace: string;
    }>
  ): Promise<Readonly<{ id: string; state: string; replayed: boolean }>>;
}
