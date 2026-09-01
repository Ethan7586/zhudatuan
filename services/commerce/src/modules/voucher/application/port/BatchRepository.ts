import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface BatchRepository {
  readBatches(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.batches.read'>, context: ExecutionContext<'voucher.batches.read'>): Promise<OperationReply<OperationOutputFor<'voucher.batches.read'>>>;
  issueBatch(transaction: WriteTransactionContext, input: OperationInputFor<'voucher.batches.issue'>, context: ExecutionContext<'voucher.batches.issue'>): Promise<OperationReply<OperationOutputFor<'voucher.batches.issue'>>>;
  retryBatch(transaction: WriteTransactionContext, input: OperationInputFor<'voucher.batches.retry'>, context: ExecutionContext<'voucher.batches.retry'>): Promise<OperationReply<OperationOutputFor<'voucher.batches.retry'>>>;
  changeStatus(transaction: WriteTransactionContext, input: OperationInputFor<'voucher.status.batch'>, context: ExecutionContext<'voucher.status.batch'>): Promise<OperationReply<OperationOutputFor<'voucher.status.batch'>>>;
  readStatusBatches(
    transaction: ReadTransactionContext,
    input: OperationInputFor<'voucher.statusbatches.read'>,
    context: ExecutionContext<'voucher.statusbatches.read'>
  ): Promise<OperationReply<OperationOutputFor<'voucher.statusbatches.read'>>>;
}
