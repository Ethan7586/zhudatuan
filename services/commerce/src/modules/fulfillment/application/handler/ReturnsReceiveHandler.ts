import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
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
