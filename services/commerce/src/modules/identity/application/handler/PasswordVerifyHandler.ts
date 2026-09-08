import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class PasswordVerifyHandler implements OperationHandler<'identity.password.verify', 'write'> {
  readonly operation = 'identity.password.verify' as const;
  readonly mode = 'write' as const;

  constructor(private readonly action: IdentityAction) {}

  async execute(input: OperationInputFor<'identity.password.verify'>, context: WriteHandlerContext<'identity.password.verify'>): Promise<OperationReply<OperationOutputFor<'identity.password.verify'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.password.verify'>(result);
  }
}
