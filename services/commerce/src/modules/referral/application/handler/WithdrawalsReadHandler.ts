import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ReferralRepository } from '../port/ReferralRepository';
import type { WithdrawalRepository } from '../port/WithdrawalRepository';

export class WithdrawalsReadHandler implements OperationHandler<'referral.withdrawals.read', 'read'> {
  readonly operation = 'referral.withdrawals.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly referrals: ReferralRepository,
    private readonly withdrawals: WithdrawalRepository
  ) {}
  async execute(input: OperationInputFor<'referral.withdrawals.read'>, context: HandlerContext<'referral.withdrawals.read'>): Promise<OperationReply<OperationOutputFor<'referral.withdrawals.read'>>> {
    const access = requireSession(context.security);
    const member = await this.referrals.eligible(context.transaction, access.scope.id, access.membership.id);
    if (!member) throw new DomainError('REFERRAL_NOT_ELIGIBLE');
    const page = queryPage(input);
    const rows = await this.withdrawals.read(context.transaction, member.scopeId, member.memberId, page);
    return { status: 200, body: keysetPage(rows, page, 'id') as OperationOutputFor<'referral.withdrawals.read'> };
  }
}
