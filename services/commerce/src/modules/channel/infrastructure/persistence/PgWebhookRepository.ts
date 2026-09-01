import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { WebhookRepository } from '../../application/port/WebhookRepository';
export class PgWebhookRepository implements WebhookRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async connection(context: ReadTransactionContext, id: string) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<{
      provider: string;
      scope_id: string;
      status: string;
    }>('select provider,scope_id,status from channel.webhook_context($1)', [id]);
    const row = result.rows[0];
    if (!row) throw new Error('CHANNEL_WEBHOOK_CONNECTION_UNAVAILABLE');
    return Object.freeze({ provider: row.provider, scope: row.scope_id, status: row.status });
  }
  async accept(context: WriteTransactionContext, input: Parameters<WebhookRepository['accept']>[1]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<{
      id: string;
      state: string;
      replayed: boolean;
    }>(`select id,state,replayed from channel.accept_webhook($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11)`, [input.connection, input.external, 'pending', null, '{}', input.ciphertext, input.keyVersion, input.rawHash, input.signatureHash, input.receivedAt, input.trace]);
    if (!result.rows[0]) throw new Error('CHANNEL_WEBHOOK_ACCEPT_FAILED');
    return Object.freeze({ ...result.rows[0] });
  }
}
