import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ApplicationRepository } from '../port/ApplicationRepository';

export class ApplicationsCreateHandler implements OperationHandler<'experience.applications.create', 'write'> {
  readonly operation = 'experience.applications.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly applications: ApplicationRepository) {}
  async execute(input: OperationInputFor<'experience.applications.create'>, context: WriteHandlerContext<'experience.applications.create'>): Promise<OperationReply<OperationOutputFor<'experience.applications.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const created = await this.applications.create(context.transaction, {
      mall: textField(body, 'mallId'),
      actor: access.actor.id,
    });
    return { status: 201, body: created as unknown as OperationOutputFor<'experience.applications.create'> };
  }
}
