import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ChangeCustomerState } from '../process/ChangeCustomerState';

export class CustomersDisableHandler implements OperationHandler<'partner.customers.disable', 'write'> {
  readonly operation = 'partner.customers.disable' as const;
  readonly mode = 'write' as const;
  constructor(private readonly change: ChangeCustomerState) {}
  async execute(input: OperationInputFor<'partner.customers.disable'>, context: WriteHandlerContext<'partner.customers.disable'>): Promise<OperationReply<OperationOutputFor<'partner.customers.disable'>>> {
    const body = await this.change.execute(input, context, 'disabled');
    return { status: 200, body, headers: { etag: `"${body.version}"` } };
  }
}
