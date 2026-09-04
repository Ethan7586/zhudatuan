import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type {
  PaymentIntentContextInput,
  PaymentIntentContextReader,
  PaymentIntentState,
} from '../payment_zhifu';

export class PurchasePaymentIntentContext implements PaymentIntentContextReader {
  async read(database: OperationDatabase, input: PaymentIntentContextInput): Promise<PaymentIntentState | undefined> {
    const result = await database.query<PaymentIntentState>(
      'select * from access.purchase_payment_intent_context($1,$2,$3,$4,$5)',
      [input.membership, input.session, input.order, input.applicationHash, input.mall],
    );
    return result.rows[0];
  }
}
