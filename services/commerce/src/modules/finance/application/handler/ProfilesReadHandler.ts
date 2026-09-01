import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { InvoiceRepository } from '../port/OperationRepositories';

export class ProfilesReadHandler implements OperationHandler<'invoice.profiles.read', 'read'> {
  readonly operation = 'invoice.profiles.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly invoices: InvoiceRepository) {}
  async execute(input: OperationInputFor<'invoice.profiles.read'>, context: HandlerContext<'invoice.profiles.read'>) {
    const result = await this.invoices.profilesRead(context.transaction, input, context);
    return result;
  }
}
