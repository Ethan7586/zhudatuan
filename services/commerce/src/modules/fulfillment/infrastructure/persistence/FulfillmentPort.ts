import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
export class FulfillmentPort {
  private readonly transactions = new PgTransactionAccess();
  async reconciliation(context: ReadTransactionContext, references: readonly string[]) {
    const database = this.transactions.database(context);
    if (references.length === 0) return Object.freeze([]);
    const result = await database.query<{
      reference: string;
      kind: 'fulfillment';
      id: string;
      amountMinor: number;
    }>(
      `select external_reference reference,'fulfillment'::text kind,id,coalesce(amount_minor,0)::float8 "amountMinor"
      from fulfillment.fulfillmentorder where external_reference=any($1::text[]) order by external_reference,id`,
      [references]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
}
