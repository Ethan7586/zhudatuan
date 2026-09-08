import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { OrganizationRepository } from '../port/OrganizationRepository';
export class LayersReadHandler implements OperationHandler<'organization.layers.read', 'read'> {
  readonly operation = 'organization.layers.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly organizations: OrganizationRepository) {}
  async execute(input: OperationInputFor<'organization.layers.read'>, context: HandlerContext<'organization.layers.read'>): Promise<OperationReply<OperationOutputFor<'organization.layers.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.organizations.layers(context.transaction, { scope: access.scope.id, after: page.id, fetch: page.fetch });
    const result = keysetPage(rows, page, 'id');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'organization.layers.read'> };
  }
}
