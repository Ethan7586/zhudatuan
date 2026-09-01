import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface VoucherRepository {
  readBindings(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.bindings.read'>, context: ExecutionContext<'voucher.bindings.read'>): Promise<OperationReply<OperationOutputFor<'voucher.bindings.read'>>>;
  manageBinding(transaction: WriteTransactionContext, input: OperationInputFor<'voucher.bindings.manage'>, context: ExecutionContext<'voucher.bindings.manage'>): Promise<OperationReply<OperationOutputFor<'voucher.bindings.manage'>>>;
  readRedemptions(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.redemptions.read'>, context: ExecutionContext<'voucher.redemptions.read'>): Promise<OperationReply<OperationOutputFor<'voucher.redemptions.read'>>>;
  reverseRedemption(
    transaction: WriteTransactionContext,
    input: OperationInputFor<'voucher.redemptions.reverse'>,
    context: ExecutionContext<'voucher.redemptions.reverse'>
  ): Promise<OperationReply<OperationOutputFor<'voucher.redemptions.reverse'>>>;
  readHistory(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.history.read'>, context: ExecutionContext<'voucher.history.read'>): Promise<OperationReply<OperationOutputFor<'voucher.history.read'>>>;
}
