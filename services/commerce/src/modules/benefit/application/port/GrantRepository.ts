import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
export interface GrantRepository {
  readGrants(transaction: ReadTransactionContext, input: OperationInputFor<'benefit.grants.read'>, context: ExecutionContext<'benefit.grants.read'>): Promise<OperationReply<OperationOutputFor<'benefit.grants.read'>>>;
  createGrant(transaction: WriteTransactionContext, input: OperationInputFor<'benefit.grants.create'>, context: ExecutionContext<'benefit.grants.create'>): Promise<OperationReply<OperationOutputFor<'benefit.grants.create'>>>;
  decideGrant(transaction: WriteTransactionContext, input: OperationInputFor<'benefit.grants.decide'>, context: ExecutionContext<'benefit.grants.decide'>): Promise<OperationReply<OperationOutputFor<'benefit.grants.decide'>>>;
  controlGrant(transaction: WriteTransactionContext, input: OperationInputFor<'benefit.grants.control'>, context: ExecutionContext<'benefit.grants.control'>): Promise<OperationReply<OperationOutputFor<'benefit.grants.control'>>>;
  revokeGrant(transaction: WriteTransactionContext, input: OperationInputFor<'benefit.grants.revoke'>, context: ExecutionContext<'benefit.grants.revoke'>): Promise<OperationReply<OperationOutputFor<'benefit.grants.revoke'>>>;
}
