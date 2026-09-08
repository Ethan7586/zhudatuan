import { PROVIDER_REQUIREMENTS, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ListingFacetRepository } from '../port/ListingFacetRepository';
import type { CatalogPartnerPort } from '../../../partner/public';

const providerNames = Object.freeze(Object.fromEntries(PROVIDER_REQUIREMENTS.map(({ id, label }) => [id, label])) as Readonly<Record<string, string>>);

export class FacetsReadHandler implements OperationHandler<'catalog.facets.read', 'read'> {
  readonly operation = 'catalog.facets.read' as const;
  readonly mode = 'read' as const;

  constructor(
    private readonly listings: ListingFacetRepository,
    private readonly partners: Pick<CatalogPartnerPort, 'names'>
  ) {}

  async execute(input: OperationInputFor<'catalog.facets.read'>, context: HandlerContext<'catalog.facets.read'>): Promise<OperationReply<OperationOutputFor<'catalog.facets.read'>>> {
    const access = requireSession(context.security);
    const facets = await this.listings.facets(context.transaction, {
      scope: access.scope.id,
      scopeKind: access.scope.kind,
      query: queryValue(input.query?.q),
    });
    const suppliers = await supplierFacets(facets.suppliers, access.scope.kind, context.transaction, this.partners);
    return {
      status: 200,
      body: { categories: [...facets.categories], suppliers, malls: [...facets.malls], statuses: [...facets.statuses] },
    };
  }
}

async function supplierFacets(
  facets: readonly Readonly<{ value: string; label: string | null; count: number }>[],
  scopeKind: string,
  context: Parameters<CatalogPartnerPort['names']>[0],
  partners: Pick<CatalogPartnerPort, 'names'>
) {
  if (scopeKind === 'supplier') return facets.map((item) => ({ ...item, label: item.label ?? providerNames[item.value] ?? '其他服务商' }));
  const result = await Promise.allSettled([partners.names(context, facets.map(({ value }) => value))]);
  const names = result[0]?.status === 'fulfilled' ? result[0].value : new Map<string, string>();
  return facets.map((item) => ({ ...item, label: item.label ?? names.get(item.value) ?? '未命名供应商' }));
}

function queryValue(value: unknown): string {
  return (Array.isArray(value) ? value[0] : value)?.toString().trim().slice(0, 200) ?? '';
}
