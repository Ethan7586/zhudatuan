import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { InvoiceReadRepository } from '../port/FinanceReadRepository';

export class ProfilesReadHandler implements OperationHandler<'invoice.profiles.read', 'read'> {
  readonly operation = 'invoice.profiles.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly invoices: InvoiceReadRepository) {}
  async execute(input: OperationInputFor<'invoice.profiles.read'>, context: HandlerContext<'invoice.profiles.read'>) {
    const result = await this.invoices.profilesRead(context.transaction, input, context);
    return result;
  }
}
