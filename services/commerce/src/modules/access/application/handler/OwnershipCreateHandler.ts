import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { ownershipEvent } from '../../domain/event/OwnershipEvents';
import type { ManageOwnershipTransfer } from '../process/ManageOwnershipTransfer';

export class OwnershipCreateHandler implements OperationHandler<'access.ownership.transfers.create', 'write'> {
  readonly operation = 'access.ownership.transfers.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly ownership: ManageOwnershipTransfer) {}
  async execute(input: OperationInputFor<'access.ownership.transfers.create'>, context: WriteHandlerContext<'access.ownership.transfers.create'>): Promise<OperationReply<OperationOutputFor<'access.ownership.transfers.create'>>> {
    const body = await this.ownership.create(input, context);
    const access = requireSession(context.security);
    return {
      status: 201,
      body,
      headers: { etag: `"${body.version}"` },
      events: [
        ownershipEvent({
          type: 'access.owner.transfer.initiated',
          transfer: body.id,
          scope: access.scope.id,
          actor: access.membership.id,
          trace: context.traceId,
          version: body.version,
          payload: { transfer: body.id, scope: access.scope.id, sourceMembership: body.sourceMembership, targetMembership: body.targetMembership, version: body.version },
        }),
      ],
    };
  }
}
