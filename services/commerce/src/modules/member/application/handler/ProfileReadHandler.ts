import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { MemberRepository } from '../port/MemberRepository';

export class ProfileReadHandler implements OperationHandler<'member.profile.read', 'read'> {
  readonly operation = 'member.profile.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly members: MemberRepository) {}

  async execute(_input: OperationInputFor<'member.profile.read'>, context: HandlerContext<'member.profile.read'>): Promise<OperationReply<OperationOutputFor<'member.profile.read'>>> {
    const access = requireSession(context.security);
    const membership = await this.members.membership(context.transaction, access.membership.id);
    const profile = await this.members.profile(context.transaction, membership.member);
    if (!profile) throw new DomainError('RESOURCE_NOT_FOUND');
    return {
      status: 200,
      body: {
        id: profile.id,
        display_name: profile.displayName,
        status: profile.status,
        mobile_bound: profile.mobileBound,
        membership_id: membership.id,
        organization_id: membership.organization,
        employee_no: membership.employee,
        joined_at: membership.joinedAt,
        access_version: membership.accessVersion,
        locale: profile.locale,
        timezone: profile.timezone,
        marketing_allowed: profile.marketingAllowed,
        preference_version: profile.preferenceVersion,
      } as OperationOutputFor<'member.profile.read'>,
    };
  }
}
