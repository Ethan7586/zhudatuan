import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { MemberRepository } from '../port/MemberRepository';

export class FavoritesPutHandler implements OperationHandler<'member.favorites.put', 'write'> {
  readonly operation = 'member.favorites.put' as const;
  readonly mode = 'write' as const;
  constructor(private readonly members: MemberRepository) {}

  async execute(input: OperationInputFor<'member.favorites.put'>, context: WriteHandlerContext<'member.favorites.put'>): Promise<OperationReply<OperationOutputFor<'member.favorites.put'>>> {
    const access = requireSession(context.security);
    const favorite = bodyRecord(input).favorite;
    if (typeof favorite !== 'boolean') throw new DomainError('VALIDATION_FAILED', { field: 'favorite' });
    const membership = await this.members.membership(context.transaction, access.membership.id);
    try {
      const row = await this.members.putFavorite(context.transaction, membership.member, input.path.listingid, membership.organization, favorite);
      return { status: 200, body: row as OperationOutputFor<'member.favorites.put'> };
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'MEMBER_FAVORITE_LISTING_NOT_FOUND') throw new DomainError('RESOURCE_NOT_FOUND');
      throw cause;
    }
  }
}
