import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { InvoiceRequestRepository } from '../port/FinanceCommandRepository';

export class RequestsDecideHandler implements OperationHandler<'invoice.requests.decide', 'write'> {
  readonly operation = 'invoice.requests.decide' as const;
  readonly mode = 'write' as const;
  constructor(private readonly invoices: InvoiceRequestRepository) {}
  async execute(input: OperationInputFor<'invoice.requests.decide'>, context: WriteHandlerContext<'invoice.requests.decide'>) {
    const result = await this.invoices.requestsDecide(context.transaction, input, context);
    return result;
  }
}
