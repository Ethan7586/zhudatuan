import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { OrganizationRepository } from '../port/OrganizationRepository';
export class DirectorySyncRunsReadHandler implements OperationHandler<'organization.directories.syncruns.read', 'read'> {
  readonly operation = 'organization.directories.syncruns.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly organizations: OrganizationRepository) {}
  async execute(input: OperationInputFor<'organization.directories.syncruns.read'>, context: HandlerContext<'organization.directories.syncruns.read'>): Promise<OperationReply<OperationOutputFor<'organization.directories.syncruns.read'>>> {
    requireSession(context.security);
    await this.organizations.directory(context.transaction, input.path.directoryid);
    const page = queryPage(input);
    const rows = await this.organizations.runs(context.transaction, input.path.directoryid, page.id, page.fetch);
    const result = keysetPage(rows, page, 'id');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'organization.directories.syncruns.read'> };
  }
}
