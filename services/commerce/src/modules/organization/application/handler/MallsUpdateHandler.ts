import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { mallUpdatedEvent } from '../../domain/event/MallEvents';
import { updateMallCommand } from '../model/MallCommand';
import type { ManageMalls } from '../service/ManageMalls';

export class MallsUpdateHandler implements OperationHandler<'organization.malls.update', 'write'> {
  readonly operation = 'organization.malls.update' as const;
  readonly mode = 'write' as const;
  constructor(private readonly malls: ManageMalls) {}
  async execute(input: OperationInputFor<'organization.malls.update'>, context: WriteHandlerContext<'organization.malls.update'>): Promise<OperationReply<OperationOutputFor<'organization.malls.update'>>> {
    if (context.expectedVersion === undefined) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    const access = requireSession(context.security);
    const mall = await this.malls.update(context.transaction, {
      mall: input.path.mallid, patch: updateMallCommand(input), accessScope: access.scope.id, actorMembership: access.membership.id,
      expectedVersion: context.expectedVersion, now: new Date().toISOString(),
    });
    return {
      status: 200,
      body: mall.view() as OperationOutputFor<'organization.malls.update'>,
      headers: { etag: `"${mall.version}"` },
      events: [mallUpdatedEvent(mall, access.membership.id, context.traceId)],
    };
  }
}
