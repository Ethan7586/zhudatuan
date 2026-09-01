import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ListingRepository } from '../port/ListingRepository';

export class ListingsReadHandler implements OperationHandler<'catalog.listings.read', 'read'> {
  readonly operation = 'catalog.listings.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly listings: ListingRepository) {}
  async execute(input: OperationInputFor<'catalog.listings.read'>, context: HandlerContext<'catalog.listings.read'>): Promise<OperationReply<OperationOutputFor<'catalog.listings.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const query = input.query ?? {};
    const rows = await this.listings.read(context.transaction, {
      scope: access.scope.id,
      scopeKind: access.scope.kind,
      actorTarget: access.actor.target,
      query: queryValue(query.q),
      category: queryValue(query.category),
      product: queryValue(query.product),
      pool: queryValue(query.pool),
      page,
    });
    return { status: 200, body: keysetPage(rows, page, 'cursor_sort') as unknown as OperationOutputFor<'catalog.listings.read'> };
  }
}

function queryValue(value: unknown): string {
  return (Array.isArray(value) ? value[0] : value)?.toString().trim().slice(0, 200) ?? '';
}
