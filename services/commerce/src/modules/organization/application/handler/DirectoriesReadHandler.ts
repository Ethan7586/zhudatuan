import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { OrganizationRepository } from '../port/OrganizationRepository';
export class DirectoriesReadHandler implements OperationHandler<'organization.directories.read', 'read'> {
  readonly operation = 'organization.directories.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly organizations: OrganizationRepository) {}
  async execute(input: OperationInputFor<'organization.directories.read'>, context: HandlerContext<'organization.directories.read'>): Promise<OperationReply<OperationOutputFor<'organization.directories.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.organizations.directories(context.transaction, access.scope.id, page.id, page.fetch);
    const result = keysetPage(rows, page, 'id');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'organization.directories.read'> };
  }
}
