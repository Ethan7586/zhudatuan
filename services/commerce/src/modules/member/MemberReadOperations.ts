import type { OperationId } from '@shop/contract';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult, type OperationActions } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { requireGovernanceContext } from '../../foundation/security/AccessContext';

export const MEMBER_OPERATOR_READ_OPERATION_IDS = Object.freeze([
  'member.members.read',
  'member.invitations.read',
  'member.imports.read',
] as const satisfies readonly OperationId[]);

export function memberOperatorReadActions(): OperationActions {
  return {
    'member.members.read': async (request, database) => {
      const access = requireAccess(request);
      const governance = requireGovernanceContext(access);
      const page = queryPage(request);
      const result = await database.query(`with anchor as(
        select distinct on(profile.id) profile.id,profile.principal_id,profile.display_name,profile.status,
          principal.version principal_version,principal.status principal_status,
          membership.id membership_id,membership.client,membership.employee_no,membership.status membership_status,
          membership.access_version,membership.joined_at,
          to_char(coalesce(membership.joined_at,to_timestamp(0)) at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') directory_sort
        from access.membership membership
        join member.profile profile on profile.id=membership.member_id
        join identity.principal principal on principal.id=profile.principal_id
        where exists(select 1 from organization.unitclosure boundary
          where boundary.ancestor_id=$1 and boundary.descendant_id=membership.organization_id)
        order by profile.id,case membership.client when 'operator' then 0 when 'storefront' then 1 else 2 end,membership.id
      ), selected as(
        select * from anchor where $2::text is null
          or (anchor.directory_sort,anchor.id)<($2::text,$3::text)
      )
      select anchor.*,
        exists(select 1 from identity.credential credential where credential.principal_id=anchor.principal_id
          and credential.provider='password' and credential.status='active') login_identity_bound,
        (anchor.principal_id<>$5 and anchor.principal_status='active'
          and exists(select 1 from identity.credential credential where credential.principal_id=anchor.principal_id
            and credential.provider='password' and credential.status='active')
          and not exists(select 1 from access.membership owner_membership
            where owner_membership.id=$6 and owner_membership.member_id=anchor.id
              and owner_membership.status='active')) reset_allowed,
        case
          when anchor.principal_id=$5 then 'SELF_PROTECTED'
          when exists(select 1 from access.membership owner_membership
            where owner_membership.id=$6 and owner_membership.member_id=anchor.id
              and owner_membership.status='active') then 'OWNER_PROTECTED'
          when anchor.principal_status<>'active' then 'IDENTITY_INACTIVE'
          when not exists(select 1 from identity.credential credential where credential.principal_id=anchor.principal_id
            and credential.provider='password' and credential.status='active') then 'LOGIN_IDENTITY_MISSING'
          else null end reset_block_reason
      from selected anchor order by anchor.directory_sort desc,anchor.id desc limit $4`,
      [access.scope.id, page.sort, page.id, page.fetch, access.actor.id, governance.ownerMembershipId ?? null]);
      return keysetResult(result, page, 'directory_sort', 'id');
    },
    'member.invitations.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select invitation.id,invitation.organization_id scope,
        organization.name scope_name,case
          when accepted_profile.display_name is not null and invitation.destination_masked is not null
            then accepted_profile.display_name||' · '||invitation.destination_masked
          when accepted_profile.display_name is not null then accepted_profile.display_name
          when invitation.destination_masked is not null then invitation.destination_masked
          else '历史记录，邀请对象不可还原' end label,
        case when invitation.role_id='role-senior-administrator-v1:'||invitation.organization_id
          then 'senior_administrator' else 'administrator' end governance_level,
        invitation.created_by,creator.display_name created_by_name,
        invitation.max_uses,invitation.use_count,invitation.effective_at starts_at,
        invitation.expires_at,invitation.accepted_at,
        case when invitation.status='disabled' then 'revoked'
          when invitation.accepted_at is not null or invitation.use_count>=invitation.max_uses then 'used'
          when invitation.status='expired' or invitation.expires_at<=clock_timestamp() then 'expired'
          else 'active' end status,
        invitation.created_at,invitation.version
        from member.invite invitation
        join organization.organization organization on organization.id=invitation.organization_id
        left join access.membership creator_membership on creator_membership.id=invitation.created_by
        left join member.profile creator on creator.id=creator_membership.member_id
        left join access.membership accepted_membership on accepted_membership.id=invitation.accepted_membership_id
        left join member.profile accepted_profile on accepted_profile.id=accepted_membership.member_id
        where invitation.target_client='operator'
          and exists(select 1 from organization.unitclosure boundary
            where boundary.ancestor_id=$1 and boundary.descendant_id=invitation.organization_id)
          and ($2::timestamptz is null or (invitation.created_at,invitation.id)<($2::timestamptz,$3::text))
        order by invitation.created_at desc,invitation.id desc limit $4`,
      [access.scope.id, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'created_at', 'id');
    },
    'member.imports.read': async (request, database) => {
      const access = requireAccess(request);
      return rowResult(await database.query(`select job.id,job.state,job.total_count,job.cursor_value,job.success_count,job.failure_count,
        job.validation_summary,job.last_error,job.report_object_ref,job.report_sha256,job.report_size,job.created_at,job.updated_at,
        coalesce((select jsonb_agg(row_to_json(errorrow) order by errorrow.row_number,errorrow.reason_code) from
          (select row_number,reason_code,field,detail from member.importerror where job_id=job.id
            order by row_number,reason_code limit 100) errorrow),'[]'::jsonb) errors
        from member.importjob job where job.id=$1 and job.organization_id=$2`,
      [request.input.path.importid!, access.scope.id]));
    },
  };
}

export function memberOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('member', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    memberOperatorReadActions(), MEMBER_OPERATOR_READ_OPERATION_IDS);
}
