import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OperationInputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { QuoteRepository } from '../../application/port/QuoteRepository';
import { CurrentQuoteReader } from './CurrentQuoteReader';
import { QuoteCreator } from './QuoteCreator';
import { checkoutRequest } from './PgCheckoutRepository';
export class PgQuoteRepository implements QuoteRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly creator: QuoteCreator,
    private readonly reader: CurrentQuoteReader
  ) {}
  create(context: WriteTransactionContext, input: OperationInputFor<'checkout.quote.create'>, execution: ExecutionContext<'checkout.quote.create'>) {
    return this.creator.execute(checkoutRequest('checkout.quote.create', input, execution), context) as never;
  }
  current(context: ReadTransactionContext, input: OperationInputFor<'checkout.quotes.current.read'>, execution: ExecutionContext<'checkout.quotes.current.read'>) {
    return this.reader.execute(checkoutRequest('checkout.quotes.current.read', input, execution), context) as never;
  }
}
