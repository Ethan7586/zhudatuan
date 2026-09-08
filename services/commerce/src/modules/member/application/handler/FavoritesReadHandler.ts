import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { MemberCatalogPort } from '../../../catalog/public/MemberCatalogPort';
import { FavoriteList } from '../../domain/model/FavoriteList';
import type { FavoriteRepository } from '../port/FavoriteRepository';
import type { MemberRepository } from '../port/MemberRepository';

export class FavoritesReadHandler implements OperationHandler<'member.favorites.read', 'read'> {
  readonly operation = 'member.favorites.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly members: MemberRepository,
    private readonly favorites: FavoriteRepository,
    private readonly catalog: Pick<MemberCatalogPort, 'visibility'>
  ) {}

  async execute(input: OperationInputFor<'member.favorites.read'>, context: HandlerContext<'member.favorites.read'>): Promise<OperationReply<OperationOutputFor<'member.favorites.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input, 100);
    const membership = await this.members.membership(context.transaction, access.membership.id);
    const rows = await this.favorites.list(context.transaction, membership.member, page.sort, page.id, page.fetch);
    const visibility = await this.catalog.visibility(
      context.transaction,
      rows.map((row) => row.listing),
      membership.organization
    );
    const byListing = new Map(visibility.map((item) => [item.listing, item]));
    const list = new FavoriteList(membership.member);
    const projected = rows.map((row) => list.present(row, byListing.get(row.listing) ?? { listing: row.listing, visible: false, reason: 'unavailable' }));
    const result = keysetPage(projected, page, 'createdAt', 'listingId');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'member.favorites.read'> };
  }
}
