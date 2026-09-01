import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { InvoiceRepository } from '../port/OperationRepositories';

export class InvoicesReadHandler implements OperationHandler<'finance.invoices.read', 'read'> {
  readonly operation = 'finance.invoices.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly invoices: InvoiceRepository) {}
  async execute(input: OperationInputFor<'finance.invoices.read'>, context: HandlerContext<'finance.invoices.read'>) {
    const result = await this.invoices.invoicesRead(context.transaction, input, context);
    return result;
  }
}
