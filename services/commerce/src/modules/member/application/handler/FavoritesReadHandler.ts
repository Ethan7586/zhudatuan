import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { MemberRepository } from '../port/MemberRepository';

export class FavoritesReadHandler implements OperationHandler<'member.favorites.read', 'read'> {
  readonly operation = 'member.favorites.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly members: MemberRepository) {}

  async execute(input: OperationInputFor<'member.favorites.read'>, context: HandlerContext<'member.favorites.read'>): Promise<OperationReply<OperationOutputFor<'member.favorites.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input, 100);
    const membership = await this.members.membership(context.transaction, access.membership.id);
    const rows = await this.members.favorites(context.transaction, membership.member, page.sort, page.id, page.fetch);
    const result = keysetPage(rows, page, 'createdAt', 'listingId');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'member.favorites.read'> };
  }
}
