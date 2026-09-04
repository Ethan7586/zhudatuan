import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { ReferralMember } from '../../domain/model/ReferralMember';
import type { ReferralRepository } from '../port/ReferralRepository';

export class MembersDisqualifyHandler implements OperationHandler<'referral.members.disqualify', 'write'> {
  readonly operation = 'referral.members.disqualify' as const;
  readonly mode = 'write' as const;
  constructor(private readonly referrals: ReferralRepository) {}
  async execute(input: OperationInputFor<'referral.members.disqualify'>, context: WriteHandlerContext<'referral.members.disqualify'>): Promise<OperationReply<OperationOutputFor<'referral.members.disqualify'>>> {
    const access = requireSession(context.security);
    const source = await this.referrals.member(context.transaction, access.scope.id, input.path.memberid);
    if (!source || source.version !== context.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const current = new ReferralMember(source.id, source.scopeId, source.memberId, source.state, source.version, source.makerId);
    const decided = current.disqualify(access.actor.id);
    const result = await this.referrals.decideMember(context.transaction, {
      id: decided.id,
      scopeId: access.scope.id,
      actorId: access.actor.id,
      expectedVersion: current.version,
      next: 'disqualified',
      reason: textField(bodyRecord(input), 'reason', 500),
    });
    return { status: 200, body: result as OperationOutputFor<'referral.members.disqualify'> };
  }
}
