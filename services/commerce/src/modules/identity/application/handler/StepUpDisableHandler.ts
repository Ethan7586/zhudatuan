import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class StepUpDisableHandler implements OperationHandler<'identity.stepup.disable', 'write'> {
  readonly operation = 'identity.stepup.disable' as const;
  readonly mode = 'write' as const;

  constructor(private readonly action: IdentityAction) {}

  async execute(input: OperationInputFor<'identity.stepup.disable'>, context: WriteHandlerContext<'identity.stepup.disable'>): Promise<OperationReply<OperationOutputFor<'identity.stepup.disable'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.stepup.disable'>(result);
  }
}
