import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ExportRepository {
  create(context: WriteTransactionContext, input: OperationInputFor<'order.orders.export'>, execution: ExecutionContext<'order.orders.export'>): Promise<OperationReply<OperationOutputFor<'order.orders.export'>>>;
}
