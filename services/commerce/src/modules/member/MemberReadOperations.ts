import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, type OperationActions } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export const MEMBER_OPERATOR_READ_OPERATION_IDS = Object.freeze([
  'member.members.read',
] as const satisfies readonly OperationId[]);

export function memberOperatorReadActions(): OperationActions {
  return {
    'member.members.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`with anchor as(
        select distinct on(profile.id) profile.id,profile.principal_id,profile.display_name,profile.status,
          principal.version principal_version,principal.status principal_status,
          membership.id membership_id,membership.client,membership.employee_no,membership.status membership_status,
          membership.access_version,membership.joined_at
        from access.membership membership
        join member.profile profile on profile.id=membership.member_id
        join identity.principal principal on principal.id=profile.principal_id
        where membership.organization_id=$1 and ($2::text is null or profile.id>$2)
        order by profile.id,case membership.client when 'operator' then 0 when 'storefront' then 1 else 2 end,membership.id
      )
      select anchor.*,
        exists(select 1 from identity.credential credential where credential.principal_id=anchor.principal_id
          and credential.provider='password' and credential.status='active') login_identity_bound,
        (anchor.principal_id<>$4 and anchor.principal_status='active'
          and exists(select 1 from identity.credential credential where credential.principal_id=anchor.principal_id
            and credential.provider='password' and credential.status='active')
          and not exists(select 1 from access.membership owned
            join access.membershiprole assignment on assignment.membership_id=owned.id
              and assignment.role_id='role-platform-owner-v2' and assignment.effective_at<=clock_timestamp()
              and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
            where owned.member_id=anchor.id and owned.status='active')) reset_allowed,
        case
          when anchor.principal_id=$4 then 'SELF_PROTECTED'
          when exists(select 1 from access.membership owned join access.membershiprole assignment on assignment.membership_id=owned.id
            and assignment.role_id='role-platform-owner-v2' and assignment.effective_at<=clock_timestamp()
            and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
            where owned.member_id=anchor.id and owned.status='active') then 'OWNER_PROTECTED'
          when anchor.principal_status<>'active' then 'IDENTITY_INACTIVE'
          when not exists(select 1 from identity.credential credential where credential.principal_id=anchor.principal_id
            and credential.provider='password' and credential.status='active') then 'LOGIN_IDENTITY_MISSING'
          else null end reset_block_reason
      from anchor order by anchor.id limit $3`, [access.scope.id, page.id, page.fetch, access.actor.id]);
      return keysetResult(result, page, 'id');
    },
  };
}

export function memberOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('member', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    memberOperatorReadActions(), MEMBER_OPERATOR_READ_OPERATION_IDS);
}
