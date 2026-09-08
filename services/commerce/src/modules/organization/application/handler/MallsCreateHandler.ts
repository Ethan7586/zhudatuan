import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { mallCreatedEvent } from '../../domain/event/MallEvents';
import { createMallCommand } from '../model/MallCommand';
import type { ManageMalls } from '../service/ManageMalls';

export class MallsCreateHandler implements OperationHandler<'organization.malls.create', 'write'> {
  readonly operation = 'organization.malls.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly malls: ManageMalls) {}
  async execute(input: OperationInputFor<'organization.malls.create'>, context: WriteHandlerContext<'organization.malls.create'>): Promise<OperationReply<OperationOutputFor<'organization.malls.create'>>> {
    if (context.expectedVersion === undefined) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    const access = requireSession(context.security);
    const mall = await this.malls.create(context.transaction, {
      command: createMallCommand(input),
      accessScope: access.scope.id,
      actorMembership: access.membership.id,
      expectedParentVersion: context.expectedVersion,
      now: new Date().toISOString(),
    });
    return {
      status: 201,
      body: mall.view() as OperationOutputFor<'organization.malls.create'>,
      headers: { etag: `"${mall.version}"` },
      events: [mallCreatedEvent(mall, access.membership.id, context.traceId)],
    };
  }
}
