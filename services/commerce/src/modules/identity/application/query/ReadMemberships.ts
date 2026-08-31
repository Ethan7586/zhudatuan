import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import type { IdentityAccessPort } from '../../../access/public';
import type { IdentityMemberPort } from '../../../member/public';
import type { IdentityOrganizationPort } from '../../../organization/public';

export class ReadMemberships {
  constructor(
    private readonly members: IdentityMemberPort,
    private readonly access: IdentityAccessPort,
    private readonly organizations: IdentityOrganizationPort
  ) {}

  action(): OperationAction {
    return async (request, database) => {
      const current = requireAccess(request);
      const member = await this.members.memberForPrincipal(database, current.actor.id);
      const memberships = await this.access.memberships(database, member, 'storefront');
      const organizations = await this.organizations.names(
        database,
        memberships.map(({ organization }) => organization)
      );
      const names = new Map(organizations.map(({ id, name }) => [id, name]));
      const items = memberships.map((membership) =>
        Object.freeze({
          id: membership.id,
          organizationId: membership.organization,
          name: names.get(membership.organization) ?? membership.organization,
          current: membership.id === current.membership.id,
          accessVersion: membership.accessVersion,
        })
      );
      return { status: 200, body: { items, count: items.length } };
    };
  }
}
