import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { MemberCatalogPort } from '../../../catalog/public/MemberCatalogPort';
import { favoriteChangedEvent } from '../../domain/event/MemberEvents';
import { FavoriteList } from '../../domain/model/FavoriteList';
import type { FavoriteRepository } from '../port/FavoriteRepository';
import type { MemberRepository } from '../port/MemberRepository';

export class FavoritesPutHandler implements OperationHandler<'member.favorites.put', 'write'> {
  readonly operation = 'member.favorites.put' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly members: MemberRepository,
    private readonly favorites: FavoriteRepository,
    private readonly catalog: Pick<MemberCatalogPort, 'visibility'>
  ) {}

  async execute(input: OperationInputFor<'member.favorites.put'>, context: WriteHandlerContext<'member.favorites.put'>): Promise<OperationReply<OperationOutputFor<'member.favorites.put'>>> {
    const access = requireSession(context.security);
    const favorite = bodyRecord(input).favorite;
    if (typeof favorite !== 'boolean') throw new DomainError('VALIDATION_FAILED', { field: 'favorite' });
    const membership = await this.members.membership(context.transaction, access.membership.id);
    const visibility = favorite
      ? ((await this.catalog.visibility(context.transaction, [input.path.listingid], membership.organization))[0] ?? { listing: input.path.listingid, visible: false, reason: 'removed' as const })
      : { listing: input.path.listingid, visible: false, reason: 'removed' as const };
    const decision = new FavoriteList(membership.member).change(input.path.listingid, favorite, visibility);
    const row = await this.favorites.change(context.transaction, membership.member, decision.listing, decision.state);
    return {
      status: 200,
      body: { listingId: row.listing, favorite: row.state === 'active', createdAt: row.state === 'active' ? row.createdAt : null, version: row.version } as OperationOutputFor<'member.favorites.put'>,
      events: [favoriteChangedEvent({ member: membership.member, scope: membership.organization, actor: access.actor.id, trace: context.traceId }, { listing: row.listing, state: row.state, version: row.version })],
    };
  }
}
