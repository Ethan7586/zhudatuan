import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { ApplicationIdentity } from '../../domain/value/ApplicationIdentity';
import type { ApplicationRepository } from '../port/ApplicationRepository';

export class ApplicationsCreateHandler implements OperationHandler<'experience.applications.create', 'write'> {
  readonly operation = 'experience.applications.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly applications: ApplicationRepository) {}
  async execute(input: OperationInputFor<'experience.applications.create'>, context: WriteHandlerContext<'experience.applications.create'>): Promise<OperationReply<OperationOutputFor<'experience.applications.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const created = await this.applications.create(context.transaction, {
      accessScope: access.scope.id,
      actor: access.actor.id,
      name: textField(body, 'name'),
      identity: new ApplicationIdentity(textField(body, 'code', 32), textField(body, 'publicSlug', 48)),
    });
    return { status: 201, body: created as unknown as OperationOutputFor<'experience.applications.create'> };
  }
}
