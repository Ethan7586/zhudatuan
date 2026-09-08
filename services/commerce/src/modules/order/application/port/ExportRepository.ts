import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface ExportRepository {
  create(context: WriteTransactionContext, input: OperationInputFor<'order.orders.export'>, execution: ExecutionContext<'order.orders.export'>): Promise<OperationReply<OperationOutputFor<'order.orders.export'>>>;
}
