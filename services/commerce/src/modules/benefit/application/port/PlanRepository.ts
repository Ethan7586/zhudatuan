import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
export interface PlanRepository {
  readPlans(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.plans.read'>, context: ExecutionContext<'benefit.plans.read'>): Promise<OperationReply<OperationOutputFor<'benefit.plans.read'>>>;
  managePlan(transaction: WriteTransactionContext, input: OperationInputFor<'benefit.plans.manage'>, context: ExecutionContext<'benefit.plans.manage'>): Promise<OperationReply<OperationOutputFor<'benefit.plans.manage'>>>;
}
