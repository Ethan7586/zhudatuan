import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { ownershipEvent } from '../../domain/event/OwnershipEvents';
import type { ManageOwnershipTransfer } from '../process/ManageOwnershipTransfer';

export class OwnershipAcceptHandler implements OperationHandler<'access.ownership.transfers.accept', 'write'> {
  readonly operation = 'access.ownership.transfers.accept' as const;
  readonly mode = 'write' as const;
  constructor(private readonly ownership: ManageOwnershipTransfer) {}
  async execute(input: OperationInputFor<'access.ownership.transfers.accept'>, context: WriteHandlerContext<'access.ownership.transfers.accept'>): Promise<OperationReply<OperationOutputFor<'access.ownership.transfers.accept'>>> {
    const body = await this.ownership.accept(input, context);
    const access = requireSession(context.security);
    return {
      status: 200,
      body,
      headers: { etag: `"${body.transfer.version}"` },
      events: [ownershipEvent({
        type: 'access.owner.transferred', transfer: body.transfer.id, scope: access.scope.id, actor: access.membership.id,
        trace: context.traceId, version: body.transfer.version,
        payload: { scope: access.scope.id, previousMembership: body.transfer.sourceMembership, membership: body.transfer.targetMembership, version: body.ownership.version },
      })],
    };
  }
}
