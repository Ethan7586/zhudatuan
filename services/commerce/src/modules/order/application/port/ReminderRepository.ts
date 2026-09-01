import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ReminderRepository {
  schedule(context: WriteTransactionContext, input: OperationInputFor<'order.reminders.create'>, execution: ExecutionContext<'order.reminders.create'>): Promise<OperationReply<OperationOutputFor<'order.reminders.create'>>>;
}
