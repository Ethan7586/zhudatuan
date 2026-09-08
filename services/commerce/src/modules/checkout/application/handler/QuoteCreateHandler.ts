import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { QuoteRepository } from '../port/QuoteRepository';

export class QuoteCreateHandler implements OperationHandler<'checkout.quote.create', 'write'> {
  readonly operation = 'checkout.quote.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly quotes: QuoteRepository) {}
  execute(input: OperationInputFor<'checkout.quote.create'>, context: WriteHandlerContext<'checkout.quote.create'>): Promise<OperationReply<OperationOutputFor<'checkout.quote.create'>>> {
    const transaction = context.transaction;
    return this.quotes.create(transaction, input, context);
  }
}
