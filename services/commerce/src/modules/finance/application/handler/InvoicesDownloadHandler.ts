import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { InvoiceRepository } from '../port/OperationRepositories';

export class InvoicesDownloadHandler implements OperationHandler<'finance.invoices.download', 'read'> {
  readonly operation = 'finance.invoices.download' as const;
  readonly mode = 'read' as const;
  constructor(private readonly invoices: InvoiceRepository) {}
  async execute(input: OperationInputFor<'finance.invoices.download'>, context: HandlerContext<'finance.invoices.download'>) {
    const result = await this.invoices.invoicesDownload(context.transaction, input, context);
    return result;
  }
}
