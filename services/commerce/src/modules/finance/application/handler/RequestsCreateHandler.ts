import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { InvoiceRequestRepository } from '../port/FinanceCommandRepository';

export class RequestsCreateHandler implements OperationHandler<'invoice.requests.create', 'write'> {
  readonly operation = 'invoice.requests.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly invoices: InvoiceRequestRepository) {}
  async execute(input: OperationInputFor<'invoice.requests.create'>, context: WriteHandlerContext<'invoice.requests.create'>) {
    const result = await this.invoices.requestsCreate(context.transaction, input, context);
    return result;
  }
}
