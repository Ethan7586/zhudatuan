import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { OrganizationReadPort } from '../../../organization/public';
import type { OrderPaymentPort } from '../../../order/public';
import type { RefundRepository } from '../../application/port/RefundRepository';
import { RefundPlanner } from './RefundPlanner';

export class PgRefundRepository implements RefundRepository {
  private readonly planner: RefundPlanner;

  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly organizations: Pick<OrganizationReadPort, 'descendants'>,
    orders: Pick<OrderPaymentPort, 'payment' | 'recordRefund'>
  ) {
    this.planner = new RefundPlanner(orders);
  }

  async create(context: WriteTransactionContext, input: Parameters<RefundRepository['create']>[1]) {
    const database = this.transactions.database(context);
    const scopes = await this.organizations.descendants(context, input.scope);
    const refund = await this.planner.create(context, { ...input, scopes });
    await new PgRuntimeWriter(database).schedule({
      id: `job:${refund.id}`,
      kind: 'paymentrefund',
      owner: 'payment',
      scope: input.scope,
      payload: { refund: refund.id, actor: input.actor },
      priority: 10,
    });
    return Object.freeze({ ...refund });
  }
}
