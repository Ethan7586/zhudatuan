import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { organizationScope } from '../../../../platform/security/OrganizationScope';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
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
    const kind = partnerKind(input.query?.kind);
    const scopes = await this.organizations.descendants(context.transaction, organizationScope(access.scope));
    const rows = await this.partners.partners(context.transaction, { scopes, own: access.scope.id, kind, sort: page.sort, id: page.id, fetch: page.fetch });
    const result = keysetPage(rows, page, 'updated_at');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'partner.partners.read'> };
  }
}
function partnerKind(value: unknown): 'supplier' | 'brand' | 'store' | null {
  if (value === undefined || value === null) return null;
  if (value === 'supplier' || value === 'brand' || value === 'store') return value;
  throw new DomainError('VALIDATION_FAILED');
}
