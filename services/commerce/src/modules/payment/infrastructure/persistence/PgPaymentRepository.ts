import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MemberAccessPort } from '../../../access/public';
import type { PaymentOrderPort } from '../../../order/public';
import type { PaymentRepository } from '../../application/port/PaymentRepository';
import { PaymentReader } from './PaymentReader';
export class PgPaymentRepository implements PaymentRepository {
  private readonly reader: PaymentReader;
  constructor(
    private readonly transactions: PgTransactionAccess,
    members: Pick<MemberAccessPort, 'member'>,
    orders: Pick<PaymentOrderPort, 'payment'>
  ) {
    this.reader = new PaymentReader(members, orders);
  }
  read(context: ReadTransactionContext, membership: string, payment: string) {
    const database = this.transactions.database(context);
    return this.reader.execute(database, membership, payment);
  }
}
