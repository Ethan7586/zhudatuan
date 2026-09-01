import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OperationInputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { AfterSalePolicyPort } from '../../../qualification/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { AfterSaleRepository } from '../../application/port/AfterSaleRepository';
import type { VerifiedAfterSaleAttachment } from '../../application/service/AfterSaleAttachmentService';
import { AfterSalePersistence } from './AfterSalePersistence';
import { orderRequest } from './PgOrderRepository';
export class PgAfterSaleRepository implements AfterSaleRepository {
  private readonly persistence: AfterSalePersistence;
  constructor(
    private readonly transactions: PgTransactionAccess,
    policies: AfterSalePolicyPort,
    organizations: OrganizationReadPort
  ) {
    this.persistence = new AfterSalePersistence(policies, organizations);
  }
  read(context: ReadTransactionContext, input: OperationInputFor<'order.aftersales.read'>, execution: ExecutionContext<'order.aftersales.read'>) {
    const database = this.transactions.database(context);
    return this.persistence.read(orderRequest('order.aftersales.read', input, execution), this.transactions.database(context)) as never;
  }
  apply(context: ReadTransactionContext, input: OperationInputFor<'order.aftersales.apply'>, execution: ExecutionContext<'order.aftersales.apply'>, attachments: readonly VerifiedAfterSaleAttachment[]) {
    const database = this.transactions.database(context);
    return this.persistence.apply(orderRequest('order.aftersales.apply', input, execution), this.transactions.database(context), attachments) as never;
  }
  approve(context: ReadTransactionContext, input: OperationInputFor<'order.aftersales.approve'>, execution: ExecutionContext<'order.aftersales.approve'>) {
    const database = this.transactions.database(context);
    return this.persistence.review(orderRequest('order.aftersales.approve', input, execution), this.transactions.database(context), 'approved') as never;
  }
  reject(context: ReadTransactionContext, input: OperationInputFor<'order.aftersales.reject'>, execution: ExecutionContext<'order.aftersales.reject'>) {
    const database = this.transactions.database(context);
    return this.persistence.review(orderRequest('order.aftersales.reject', input, execution), this.transactions.database(context), 'rejected') as never;
  }
}
