import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ApplicationRepository } from '../port/ApplicationRepository';

export class ApplicationDetailHandler implements OperationHandler<'experience.applications.detail.read', 'read'> {
  readonly operation = 'experience.applications.detail.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly applications: ApplicationRepository) {}

  async execute(input: OperationInputFor<'experience.applications.detail.read'>, context: HandlerContext<'experience.applications.detail.read'>): Promise<OperationReply<OperationOutputFor<'experience.applications.detail.read'>>> {
    const access = requireSession(context.security);
    const body = await this.applications.detail(context.transaction, { scope: organizationScope(access.scope), application: input.path.applicationid });
    return { status: 200, body: body as OperationOutputFor<'experience.applications.detail.read'> };
  }
}
