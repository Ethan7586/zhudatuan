import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { OrganizationHierarchyPort } from '../../../organization/public/HierarchyPort';
import type { PartnerRepository } from '../port/PartnerRepository';
export class PartnersReadHandler implements OperationHandler<'partner.partners.read', 'read'> {
  readonly operation = 'partner.partners.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly partners: PartnerRepository,
    private readonly organizations: OrganizationHierarchyPort
  ) {}
  async execute(input: OperationInputFor<'partner.partners.read'>, context: HandlerContext<'partner.partners.read'>): Promise<OperationReply<OperationOutputFor<'partner.partners.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const scopes = await this.organizations.descendants(context.transaction, organizationScope(access.scope));
    const rows = await this.partners.partners(context.transaction, { scopes, own: access.scope.id, sort: page.sort, id: page.id, fetch: page.fetch });
    const result = keysetPage(rows, page, 'updated_at');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'partner.partners.read'> };
  }
}
