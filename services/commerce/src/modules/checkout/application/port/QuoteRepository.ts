import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface QuoteRepository {
  create(context: WriteTransactionContext, input: OperationInputFor<'checkout.quote.create'>, execution: ExecutionContext<'checkout.quote.create'>): Promise<OperationReply<OperationOutputFor<'checkout.quote.create'>>>;
  current(context: ReadTransactionContext, input: OperationInputFor<'checkout.quotes.current.read'>, execution: ExecutionContext<'checkout.quotes.current.read'>): Promise<OperationReply<OperationOutputFor<'checkout.quotes.current.read'>>>;
}
