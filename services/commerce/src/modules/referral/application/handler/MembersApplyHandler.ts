import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { ReferralMember } from '../../domain/model/ReferralMember';
import type { Identifier } from '../port/Identifier';
import type { ReferralRepository } from '../port/ReferralRepository';

export class MembersApplyHandler implements OperationHandler<'referral.members.apply', 'write'> {
  readonly operation = 'referral.members.apply' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly referrals: ReferralRepository,
    private readonly identifiers: Identifier
  ) {}
  async execute(input: OperationInputFor<'referral.members.apply'>, context: WriteHandlerContext<'referral.members.apply'>): Promise<OperationReply<OperationOutputFor<'referral.members.apply'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const member = await this.referrals.eligible(context.transaction, access.scope.id, access.membership.id);
    if (!member) throw new DomainError('REFERRAL_NOT_ELIGIBLE');
    const model = new ReferralMember(this.identifiers.next('referralmember'), member.scopeId, member.memberId, 'applied', 1, access.actor.id);
    const result = await this.referrals.applyMember(context.transaction, {
      id: model.id,
      scopeId: model.scopeId,
      memberId: model.memberId,
      displayName: textField(body, 'displayName'),
      mobile: textField(body, 'mobile', 20),
      makerId: access.actor.id,
      reason: textField(body, 'reason', 500),
    });
    return { status: 201, body: result as OperationOutputFor<'referral.members.apply'> };
  }
}
