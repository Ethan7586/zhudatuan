import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { requireAccess } from '../../../../foundation/application/OperationAccess';

import type { IdentityAccessPort } from '../../../access/public';
import type { IdentityMemberPort } from '../../../member/public';

export class ReadMemberships {
  constructor(
    private readonly members: IdentityMemberPort,
    private readonly access: IdentityAccessPort
  ) {}

  action(): OperationAction<'read'> {
    return async (request, database) => {
      const current = requireAccess(request);
      const member = await this.members.memberForPrincipal(database, current.actor.id);
      const memberships = await this.access.memberships(database, member, 'storefront');
      const items = memberships.map((membership) =>
        Object.freeze({
          id: membership.id,
          target: membership.target,
          displayName: membership.displayName,
          organizationName: membership.organizationName,
          scopeKind: membership.scopeKind,
          scopeId: membership.scopeId,
          roleLabel: membership.roleLabel,
          logoUrl: membership.logoUrl,
          current: membership.id === current.membership.id,
          accessVersion: membership.accessVersion,
        })
      );
      return { status: 200, body: { items, count: items.length } };
    };
  }
}
