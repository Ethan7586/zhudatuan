import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { InvoiceRequestRepository } from '../port/FinanceCommandRepository';

export class RequestsCancelHandler implements OperationHandler<'invoice.requests.cancel', 'write'> {
  readonly operation = 'invoice.requests.cancel' as const;
  readonly mode = 'write' as const;
  constructor(private readonly invoices: InvoiceRequestRepository) {}
  async execute(input: OperationInputFor<'invoice.requests.cancel'>, context: WriteHandlerContext<'invoice.requests.cancel'>) {
    const result = await this.invoices.requestsCancel(context.transaction, input, context);
    return result;
  }
}
