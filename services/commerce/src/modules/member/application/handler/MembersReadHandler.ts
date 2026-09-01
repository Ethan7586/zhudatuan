import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { MemberRepository } from '../port/MemberRepository';

export class MembersReadHandler implements OperationHandler<'member.members.read', 'read'> {
  readonly operation = 'member.members.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly members: MemberRepository) {}

  async execute(input: OperationInputFor<'member.members.read'>, context: HandlerContext<'member.members.read'>): Promise<OperationReply<OperationOutputFor<'member.members.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const memberships = await this.members.memberships(context.transaction, access.scope.id, page.id, page.fetch);
    const profiles = await this.members.profiles(context.transaction, [...new Set(memberships.map((membership) => membership.member))]);
    const byMember = new Map(profiles.map((profile) => [profile.id, profile]));
    const rows = memberships.flatMap((membership) => {
      const profile = byMember.get(membership.member);
      return profile
        ? [
            {
              id: profile.id,
              display_name: profile.displayName,
              status: profile.status,
              membership_id: membership.id,
              employee_no: membership.employee,
              membership_status: membership.status,
              access_version: membership.accessVersion,
              joined_at: membership.joinedAt,
            },
          ]
        : [];
    });
    const result = keysetPage(rows, page, 'membership_id', 'membership_id');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'member.members.read'> };
  }
}
