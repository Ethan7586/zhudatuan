import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { organizationScope } from '../../../../platform/security/OrganizationScope';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { OrganizationHierarchyPort } from '../../../organization/public/HierarchyPort';
import type { PartnerRepository } from '../port/PartnerRepository';
export class StoresReadHandler implements OperationHandler<'organization.stores.read', 'read'> {
  readonly operation = 'organization.stores.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly partners: PartnerRepository,
    private readonly organizations: OrganizationHierarchyPort
  ) {}
  async execute(input: OperationInputFor<'organization.stores.read'>, context: HandlerContext<'organization.stores.read'>): Promise<OperationReply<OperationOutputFor<'organization.stores.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const scopes = await this.organizations.descendants(context.transaction, organizationScope(access.scope));
    const rows = await this.partners.stores(context.transaction, { scopes, sort: page.sort, id: page.id, fetch: page.fetch });
    const result = keysetPage(rows, page, 'updatedAt');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'organization.stores.read'> };
  }
}
