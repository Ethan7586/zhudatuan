import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class EnrollmentsReadHandler implements OperationHandler<'identity.enrollments.read', 'read'> {
  readonly operation = 'identity.enrollments.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly action: IdentityAction<'read'>) {}

  async execute(input: OperationInputFor<'identity.enrollments.read'>, context: HandlerContext<'identity.enrollments.read'>): Promise<OperationReply<OperationOutputFor<'identity.enrollments.read'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.enrollments.read'>(result);
  }
}
