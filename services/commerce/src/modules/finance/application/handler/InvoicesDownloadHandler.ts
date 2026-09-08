import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { InvoiceProcessAdapter } from '../port/FinanceProcessAdapter';

export class InvoicesDownloadHandler implements OperationHandler<'finance.invoices.download', 'read'> {
  readonly operation = 'finance.invoices.download' as const;
  readonly mode = 'read' as const;
  constructor(private readonly invoices: InvoiceProcessAdapter) {}
  async execute(input: OperationInputFor<'finance.invoices.download'>, context: HandlerContext<'finance.invoices.download'>) {
    const result = await this.invoices.invoicesDownload(context.transaction, input, context);
    return result;
  }
}
