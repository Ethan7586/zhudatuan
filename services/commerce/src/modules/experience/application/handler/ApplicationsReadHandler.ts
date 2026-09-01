import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ApplicationRepository } from '../port/ApplicationRepository';

export class ApplicationsReadHandler implements OperationHandler<'experience.applications.read', 'read'> {
  readonly operation = 'experience.applications.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly applications: ApplicationRepository) {}
  async execute(input: OperationInputFor<'experience.applications.read'>, context: HandlerContext<'experience.applications.read'>): Promise<OperationReply<OperationOutputFor<'experience.applications.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const application = queryText(input.query?.application);
    const rows = await this.applications.read(context.transaction, { scope: organizationScope(access.scope), application, page });
    return { status: 200, body: keysetPage(rows, page, 'updated_at') as unknown as OperationOutputFor<'experience.applications.read'> };
  }
}

function queryText(value: unknown): string {
  return (Array.isArray(value) ? value[0] : value)?.toString().trim().slice(0, 255) ?? '';
}
