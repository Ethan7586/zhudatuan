import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { QuoteRepository } from '../port/QuoteRepository';

export class QuotesCurrentReadHandler implements OperationHandler<'checkout.quotes.current.read', 'read'> {
  readonly operation = 'checkout.quotes.current.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly quotes: QuoteRepository) {}
  execute(input: OperationInputFor<'checkout.quotes.current.read'>, context: HandlerContext<'checkout.quotes.current.read'>): Promise<OperationReply<OperationOutputFor<'checkout.quotes.current.read'>>> {
    const transaction = context.transaction;
    return this.quotes.current(transaction, input, context);
  }
}
