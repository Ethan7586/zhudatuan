import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { ChangeCustomerState } from '../process/ChangeCustomerState';

export class CustomersEnableHandler implements OperationHandler<'partner.customers.enable', 'write'> {
  readonly operation = 'partner.customers.enable' as const;
  readonly mode = 'write' as const;
  constructor(private readonly change: ChangeCustomerState) {}
  async execute(input: OperationInputFor<'partner.customers.enable'>, context: WriteHandlerContext<'partner.customers.enable'>): Promise<OperationReply<OperationOutputFor<'partner.customers.enable'>>> {
    const body = await this.change.execute(input, context, 'active');
    return { status: 200, body, headers: { etag: `"${body.version}"` } };
  }
}
