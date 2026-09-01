import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class TicketsExchangeHandler implements OperationHandler<'identity.tickets.exchange', 'write'> {
  readonly operation = 'identity.tickets.exchange' as const;
  readonly mode = 'write' as const;

  constructor(private readonly action: IdentityAction) {}

  async execute(input: OperationInputFor<'identity.tickets.exchange'>, context: WriteHandlerContext<'identity.tickets.exchange'>): Promise<OperationReply<OperationOutputFor<'identity.tickets.exchange'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.tickets.exchange'>(result);
  }
}
