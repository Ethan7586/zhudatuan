import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { InvoiceProfileRepository } from '../port/FinanceCommandRepository';

export class ProfilesManageHandler implements OperationHandler<'invoice.profiles.manage', 'write'> {
  readonly operation = 'invoice.profiles.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly invoices: InvoiceProfileRepository) {}
  async execute(input: OperationInputFor<'invoice.profiles.manage'>, context: WriteHandlerContext<'invoice.profiles.manage'>) {
    const result = await this.invoices.profilesManage(context.transaction, input, context);
    return result;
  }
}
