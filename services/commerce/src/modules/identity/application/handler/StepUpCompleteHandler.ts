import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class StepUpCompleteHandler implements OperationHandler<'identity.stepup.complete', 'write'> {
  readonly operation = 'identity.stepup.complete' as const;
  readonly mode = 'write' as const;

  constructor(private readonly action: IdentityAction) {}

  async execute(input: OperationInputFor<'identity.stepup.complete'>, context: WriteHandlerContext<'identity.stepup.complete'>): Promise<OperationReply<OperationOutputFor<'identity.stepup.complete'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.stepup.complete'>(result);
  }
}
