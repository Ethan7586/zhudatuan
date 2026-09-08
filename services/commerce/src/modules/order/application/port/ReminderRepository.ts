import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface ReminderRepository {
  schedule(context: WriteTransactionContext, input: OperationInputFor<'order.reminders.create'>, execution: ExecutionContext<'order.reminders.create'>): Promise<OperationReply<OperationOutputFor<'order.reminders.create'>>>;
}
