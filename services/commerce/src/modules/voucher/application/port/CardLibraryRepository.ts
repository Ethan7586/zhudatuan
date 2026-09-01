import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface CardLibraryRepository {
  read(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.cardlibraries.read'>, context: ExecutionContext<'voucher.cardlibraries.read'>): Promise<OperationReply<OperationOutputFor<'voucher.cardlibraries.read'>>>;
  create(
    transaction: WriteTransactionContext,
    input: OperationInputFor<'voucher.cardlibraries.create'>,
    context: ExecutionContext<'voucher.cardlibraries.create'>
  ): Promise<OperationReply<OperationOutputFor<'voucher.cardlibraries.create'>>>;
  allocate(
    transaction: WriteTransactionContext,
    input: OperationInputFor<'voucher.cardlibraries.allocate'>,
    context: ExecutionContext<'voucher.cardlibraries.allocate'>
  ): Promise<OperationReply<OperationOutputFor<'voucher.cardlibraries.allocate'>>>;
}
