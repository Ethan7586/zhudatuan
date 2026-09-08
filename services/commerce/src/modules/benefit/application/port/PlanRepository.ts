import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
export interface PlanRepository {
  readPlans(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.plans.read'>, context: ExecutionContext<'benefit.plans.read'>): Promise<OperationReply<OperationOutputFor<'benefit.plans.read'>>>;
  managePlan(transaction: WriteTransactionContext, input: OperationInputFor<'benefit.plans.manage'>, context: ExecutionContext<'benefit.plans.manage'>): Promise<OperationReply<OperationOutputFor<'benefit.plans.manage'>>>;
}
