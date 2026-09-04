import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ListingFacetRepository } from '../port/ListingFacetRepository';

export class FacetsReadHandler implements OperationHandler<'catalog.facets.read', 'read'> {
  readonly operation = 'catalog.facets.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly listings: ListingFacetRepository) {}

  async execute(input: OperationInputFor<'catalog.facets.read'>, context: HandlerContext<'catalog.facets.read'>): Promise<OperationReply<OperationOutputFor<'catalog.facets.read'>>> {
    const access = requireSession(context.security);
    const facets = await this.listings.facets(context.transaction, {
      scope: access.scope.id,
      scopeKind: access.scope.kind,
      query: queryValue(input.query?.q),
    });
    return {
      status: 200,
      body: { categories: [...facets.categories], suppliers: [...facets.suppliers], malls: [...facets.malls], statuses: [...facets.statuses] },
    };
  }
}

function queryValue(value: unknown): string {
  return (Array.isArray(value) ? value[0] : value)?.toString().trim().slice(0, 200) ?? '';
}
