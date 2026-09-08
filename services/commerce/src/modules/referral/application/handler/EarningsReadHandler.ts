import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import type { CommissionRepository } from '../port/CommissionRepository';
import type { ReferralRepository } from '../port/ReferralRepository';

export class EarningsReadHandler implements OperationHandler<'referral.earnings.read', 'read'> {
  readonly operation = 'referral.earnings.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly referrals: ReferralRepository,
    private readonly commissions: CommissionRepository
  ) {}
  async execute(input: OperationInputFor<'referral.earnings.read'>, context: HandlerContext<'referral.earnings.read'>): Promise<OperationReply<OperationOutputFor<'referral.earnings.read'>>> {
    const access = requireSession(context.security);
    const member = await this.referrals.eligible(context.transaction, access.scope.id, access.membership.id);
    if (!member) throw new DomainError('REFERRAL_NOT_ELIGIBLE');
    const page = queryPage(input);
    const summary = await this.commissions.earnings(context.transaction, member.scopeId, member.memberId);
    const rows = await this.commissions.read(context.transaction, member.scopeId, member.memberId, page);
    return { status: 200, body: { ...summary, ...keysetPage(rows, page, 'id') } as OperationOutputFor<'referral.earnings.read'> };
  }
}
