import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ReturnRepository } from '../port/ReturnRepository';

export class ReturnsReceiveHandler implements OperationHandler<'fulfillment.returns.receive', 'write'> {
  readonly operation = 'fulfillment.returns.receive' as const;
  readonly mode = 'write' as const;
  constructor(private readonly returns: ReturnRepository) {}
  async execute(input: OperationInputFor<'fulfillment.returns.receive'>, context: WriteHandlerContext<'fulfillment.returns.receive'>): Promise<OperationReply<OperationOutputFor<'fulfillment.returns.receive'>>> {
    const access = requireSession(context.security);
    const result = await this.returns.receive(context.transaction, { id: input.path.returnid, scope: access.scope.id, actor: access.actor.id, tracking: bodyRecord(input).tracking ?? null, expectedVersion: context.expectedVersion ?? null });
    return { status: 200, body: result as OperationOutputFor<'fulfillment.returns.receive'> };
  }
}
