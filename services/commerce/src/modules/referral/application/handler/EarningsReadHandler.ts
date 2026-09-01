import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { CommissionRepository } from '../port/CommissionRepository';
import type { ReferralRepository } from '../port/ReferralRepository';

export class EarningsReadHandler implements OperationHandler<'referral.earnings.read', 'read'> {
  readonly operation = 'referral.earnings.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly referrals: ReferralRepository,
    private readonly commissions: CommissionRepository
  ) {}
  async execute(_input: OperationInputFor<'referral.earnings.read'>, context: HandlerContext<'referral.earnings.read'>): Promise<OperationReply<OperationOutputFor<'referral.earnings.read'>>> {
    const access = requireSession(context.security);
    const member = await this.referrals.eligible(context.transaction, access.scope.id, access.membership.id);
    if (!member) throw new DomainError('REFERRAL_NOT_ELIGIBLE');
    const result = await this.commissions.earnings(context.transaction, member.scopeId, member.memberId);
    return { status: 200, body: result as OperationOutputFor<'referral.earnings.read'> };
  }
}
