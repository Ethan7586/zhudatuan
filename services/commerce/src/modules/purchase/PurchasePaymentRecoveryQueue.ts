import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { PaymentRecoveryInput, PaymentRecoveryQueue } from '../payment/PaymentContractModule';

export class PurchasePaymentRecoveryQueue implements PaymentRecoveryQueue {
  async enqueue(database: OperationDatabase, input: PaymentRecoveryInput): Promise<void> {
    await database.query(
      'select access.purchase_enqueue_payment_query($1,$2,$3,$4,$5,$6)',
      [input.membership, input.session, input.mall, input.intent, input.priority, input.delaySeconds],
    );
  }
}
