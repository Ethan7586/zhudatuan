import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { InvoiceRequestRepository } from '../port/FinanceCommandRepository';

export class RedInvoiceHandler implements OperationHandler<'invoice.requests.red', 'write'> {
  readonly operation = 'invoice.requests.red' as const;
  readonly mode = 'write' as const;
  constructor(private readonly invoices: InvoiceRequestRepository) {}
  async execute(input: OperationInputFor<'invoice.requests.red'>, context: WriteHandlerContext<'invoice.requests.red'>) {
    const result = await this.invoices.redInvoice(context.transaction, input, context);
    return result;
  }
}
