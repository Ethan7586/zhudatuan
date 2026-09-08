import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
export interface BudgetRepository {
  readBudgets(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.budgets.read'>, context: ExecutionContext<'benefit.budgets.read'>): Promise<OperationReply<OperationOutputFor<'benefit.budgets.read'>>>;
  manageBudget(transaction: WriteTransactionContext, input: OperationInputFor<'benefit.budgets.manage'>, context: ExecutionContext<'benefit.budgets.manage'>): Promise<OperationReply<OperationOutputFor<'benefit.budgets.manage'>>>;
}
