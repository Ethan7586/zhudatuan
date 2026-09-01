import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ReserveRepository {
  readReserves(transaction: ReadTransactionContext, input: OperationInputFor<'voucher.reserves.read'>, context: ExecutionContext<'voucher.reserves.read'>): Promise<OperationReply<OperationOutputFor<'voucher.reserves.read'>>>;
  requestReserve(transaction: WriteTransactionContext, input: OperationInputFor<'voucher.reserves.request'>, context: ExecutionContext<'voucher.reserves.request'>): Promise<OperationReply<OperationOutputFor<'voucher.reserves.request'>>>;
  decideReserve(transaction: WriteTransactionContext, input: OperationInputFor<'voucher.reserves.decide'>, context: ExecutionContext<'voucher.reserves.decide'>): Promise<OperationReply<OperationOutputFor<'voucher.reserves.decide'>>>;
}
