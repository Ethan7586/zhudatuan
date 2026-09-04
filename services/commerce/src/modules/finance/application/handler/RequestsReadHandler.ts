import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { InvoiceReadRepository } from '../port/FinanceReadRepository';

export class RequestsReadHandler implements OperationHandler<'invoice.requests.read', 'read'> {
  readonly operation = 'invoice.requests.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly invoices: InvoiceReadRepository) {}
  async execute(input: OperationInputFor<'invoice.requests.read'>, context: HandlerContext<'invoice.requests.read'>) {
    const result = await this.invoices.requestsRead(context.transaction, input, context);
    return result;
  }
}
