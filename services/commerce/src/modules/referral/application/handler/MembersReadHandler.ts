import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ReferralRepository } from '../port/ReferralRepository';

export class MembersReadHandler implements OperationHandler<'referral.members.read', 'read'> {
  readonly operation = 'referral.members.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly referrals: ReferralRepository) {}
  async execute(input: OperationInputFor<'referral.members.read'>, context: HandlerContext<'referral.members.read'>): Promise<OperationReply<OperationOutputFor<'referral.members.read'>>> {
    const page = queryPage(input);
    const rows = await this.referrals.members(context.transaction, requireSession(context.security).scope.id, page);
    return { status: 200, body: keysetPage(rows, page, 'id') as OperationOutputFor<'referral.members.read'> };
  }
}
