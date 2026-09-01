import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { AddressRepository } from '../port/AddressRepository';
import type { MemberRepository } from '../port/MemberRepository';

export class AddressesReadHandler implements OperationHandler<'member.addresses.read', 'read'> {
  readonly operation = 'member.addresses.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly members: MemberRepository,
    private readonly addresses: AddressRepository
  ) {}

  async execute(input: OperationInputFor<'member.addresses.read'>, context: HandlerContext<'member.addresses.read'>): Promise<OperationReply<OperationOutputFor<'member.addresses.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input, 100);
    const membership = await this.members.membership(context.transaction, access.membership.id);
    const rows = await this.addresses.list(context.transaction, membership.member, page.id, page.fetch);
    const result = keysetPage(rows, page, 'id');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'member.addresses.read'> };
  }
}
