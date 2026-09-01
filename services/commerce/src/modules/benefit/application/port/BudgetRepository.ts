import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
export interface BudgetRepository {
  readBudgets(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.budgets.read'>, context: ExecutionContext<'benefit.budgets.read'>): Promise<OperationReply<OperationOutputFor<'benefit.budgets.read'>>>;
  manageBudget(transaction: WriteTransactionContext, input: OperationInputFor<'benefit.budgets.manage'>, context: ExecutionContext<'benefit.budgets.manage'>): Promise<OperationReply<OperationOutputFor<'benefit.budgets.manage'>>>;
}
