import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ReturnRepository } from '../port/ReturnRepository';

export class ReturnsInspectHandler implements OperationHandler<'fulfillment.returns.inspect', 'write'> {
  readonly operation = 'fulfillment.returns.inspect' as const;
  readonly mode = 'write' as const;
  constructor(private readonly returns: ReturnRepository) {}
  async execute(input: OperationInputFor<'fulfillment.returns.inspect'>, context: WriteHandlerContext<'fulfillment.returns.inspect'>): Promise<OperationReply<OperationOutputFor<'fulfillment.returns.inspect'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const result = await this.returns.inspect(context.transaction, {
      id: input.path.returnid,
      scope: access.scope.id,
      actor: access.actor.id,
      trace: access.trace,
      accepted: body.accepted === true,
      evidence: body.inspection ?? {},
      expectedVersion: context.expectedVersion ?? null,
    });
    return { status: 200, body: result as OperationOutputFor<'fulfillment.returns.inspect'> };
  }
}
