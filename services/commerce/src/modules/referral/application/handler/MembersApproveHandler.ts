import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { ReferralMember } from '../../domain/model/ReferralMember';
import type { ReferralRepository } from '../port/ReferralRepository';

export class MembersApproveHandler implements OperationHandler<'referral.members.approve', 'write'> {
  readonly operation = 'referral.members.approve' as const;
  readonly mode = 'write' as const;
  constructor(private readonly referrals: ReferralRepository) {}
  async execute(input: OperationInputFor<'referral.members.approve'>, context: WriteHandlerContext<'referral.members.approve'>): Promise<OperationReply<OperationOutputFor<'referral.members.approve'>>> {
    const access = requireSession(context.security);
    const source = await this.referrals.member(context.transaction, access.scope.id, input.path.memberid);
    if (!source || source.version !== context.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const current = new ReferralMember(source.id, source.scopeId, source.memberId, source.state, source.version, source.makerId);
    const decided = current.approve(access.actor.id);
    const result = await this.referrals.decideMember(context.transaction, {
      id: decided.id,
      scopeId: access.scope.id,
      actorId: access.actor.id,
      expectedVersion: current.version,
      next: 'active',
      reason: textField(bodyRecord(input), 'reason', 500),
    });
    return { status: 200, body: result as OperationOutputFor<'referral.members.approve'> };
  }
}
