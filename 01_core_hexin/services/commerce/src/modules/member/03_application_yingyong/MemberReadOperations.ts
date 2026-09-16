import {
  StorefrontMemberDetailSchema,
  StorefrontMemberInviteePageSchema,
  StorefrontMemberOrderPageSchema,
  StorefrontMemberPageSchema,
  type OperationId,
} from '@shop/contract';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult, type OperationActions } from '../../../foundation/application/ModuleOperations';
import { KMS_CLIENT, type KmsClient } from '../../../foundation/infrastructure/KmsClient';
import { keysetResult, queryPage } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import { requireGovernanceContext } from '../../../foundation/security/AccessContext';
import { presentIdentityDisplays, resolveIdentityDisplayMembership } from '../../identity-display/IdentityDisplayPresenter';
import { readMemberDetail } from '../04_adapters_shixian/persistence/MemberDetailReader';
import { readMemberDirectory } from './MemberDirectoryReader';

export const MEMBER_OPERATOR_READ_OPERATION_IDS = Object.freeze([
  'member.members.read',
  'member.storefront.members.read',
  'member.storefront.detail.read',
  'member.storefront.invitees.read',
  'member.storefront.orders.read',
  'member.invitations.read',
  'member.imports.read',
] as const satisfies readonly OperationId[]);

export function memberOperatorReadActions(kms: Pick<KmsClient, 'decrypt'>): OperationActions {
  return {
    'member.members.read': async (request, database) => {
      const access = requireAccess(request);
      const governance = requireGovernanceContext(access);
      const page = queryPage(request);
      const result = await database.query<OperatorDirectoryRow>(`with recursive governance_subtree(membership_id) as(
        select actor.id
        from access.membership actor
        where actor.id=$8 and actor.client='operator' and actor.status='active'
        union
        select child.id
        from access.membership child
        join governance_subtree parent on child.governance_parent_membership_id=parent.membership_id
        where child.client='operator' and child.status='active'
      ), anchor as(
        select distinct on(profile.id) profile.id,profile.principal_id,
          coalesce(membership.operator_display_name,profile.display_name) display_name,profile.status,
          principal.version principal_version,principal.status principal_status,
          membership.id membership_id,membership.client,membership.employee_no,membership.status membership_status,
          membership.access_version,membership.joined_at,membership.governance_parent_membership_id,
          account.mobile_masked,case when $9::boolean then account.mobile_ciphertext else null end mobile_ciphertext,
          governance_parent_profile.display_name governance_parent_name,
          to_char(coalesce(membership.joined_at,to_timestamp(0)) at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') directory_sort
        from access.membership membership
        join member.profile profile on profile.id=membership.member_id
        join identity.principal principal on principal.id=profile.principal_id
        left join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
        left join access.membership governance_parent
          on governance_parent.id=membership.governance_parent_membership_id
        left join member.profile governance_parent_profile on governance_parent_profile.id=governance_parent.member_id
        where membership.client='operator' and membership.status='active'
          and exists(select 1 from organization.unitclosure boundary
          where boundary.ancestor_id=$1 and boundary.descendant_id=membership.organization_id)
          and ($7::boolean or exists(select 1 from governance_subtree visible where visible.membership_id=membership.id))
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
      [access.scope.id, page.sort, page.id, page.fetch, access.actor.id, governance.ownerMembershipId ?? null,
        governance.isExactOwner, governance.actorMembershipId, governance.governanceLevel === 'owner']);
      const rows = await Promise.all(result.rows.map(async ({ mobile_ciphertext: ciphertext, ...row }) => Object.freeze({
        ...row,
        mobile: ciphertext == null ? null : await kms.decrypt('identity/mobile', ciphertext, { principal: row.principal_id }),
      })));
      const displays = await presentIdentityDisplays(database, access.scope.id, 'operator', rows.map((row) => ({
        membershipId: String(row.membership_id), maskedMobile: typeof row.mobile_masked === 'string' ? row.mobile_masked : null,
      })));
      return keysetResult({ ...result, rows: rows.map((row) => {
        const identityDisplay = displays.get(String(row.membership_id));
        return identityDisplay === undefined ? row : { ...row, identity_display: identityDisplay };
      }) }, page, 'directory_sort', 'id');
    },
    'member.storefront.members.read': async (request, database) => {
      const access = requireAccess(request);
      if (access.scope.kind !== 'mall') throw new Error('SCOPE_NOT_ALLOWED_FOR_OPERATION');
      const page = queryPage(request);
      const query = queryValue(request.input.query.q);
      const identityMembership = await resolveIdentityDisplayMembership(database, access.scope.id, 'member', query);
      const result = await readMemberDirectory(database, access.scope.id, query, page.sort, page.fetch, identityMembership ?? null);
      const rows = await withMemberIdentityDisplays(database, access.scope.id, result.rows);
      const response = keysetResult({ ...result, rows }, page, 'membership_id', 'membership_id');
      return { ...response, body: StorefrontMemberPageSchema.parse(response.body) };
    },
    'member.storefront.detail.read': async (request, database) => {
      const access = requireAccess(request);
      if (access.scope.kind !== 'mall') throw new Error('SCOPE_NOT_ALLOWED_FOR_OPERATION');
      const result = await readMemberDetail(database, access.scope.id, request.input.path.membershipid!);
      const rows = await withMemberIdentityDisplays(database, access.scope.id, result.rows);
      const response = rowResult({ ...result, rows });
      return { ...response, body: StorefrontMemberDetailSchema.parse(response.body) };
    },
    'member.storefront.invitees.read': async (request, database) => {
      const access = requireAccess(request);
      if (access.scope.kind !== 'mall') throw new Error('SCOPE_NOT_ALLOWED_FOR_OPERATION');
      const page = queryPage(request, 50);
      const result = await database.query(`with target as(
        select membership.member_id from access.membership membership
        where membership.id=$2 and membership.organization_id=$1 and membership.client='storefront'
      ) select invited_membership.id membership_id,invited_profile.display_name,invited_profile.mobile_masked,
        invited_membership.status membership_status,invited_context.signed_level identity_level,
        to_char(binding.bound_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') bound_at,
        case when binding.expires_at is null then null else to_char(
          binding.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end expires_at,
        case when binding.expires_at is not null and binding.expires_at<=clock_timestamp()
          then 'expired' else 'active' end relationship_status
        from target
        join referral.member referral_owner on referral_owner.scope_id=$1 and referral_owner.member_id=target.member_id
        join referral.binding binding on binding.scope_id=$1 and binding.referral_member_id=referral_owner.id
        join access.membership invited_membership on invited_membership.organization_id=$1
          and invited_membership.client='storefront' and invited_membership.member_id=binding.customer_member_id
        join lateral identity.resolve_storefront_member_context(
          invited_membership.id,invited_membership.organization_id
        ) invited_context on invited_context.node_profile='consumer'
          and invited_context.signed_level in('L7','L8','L9','L10','L11')
        join member.profile invited_profile on invited_profile.id=invited_membership.member_id
        where ($3::timestamptz is null or (binding.bound_at,invited_membership.id)<($3::timestamptz,$4))
        order by binding.bound_at desc,invited_membership.id desc limit $5`,
      [access.scope.id, request.input.path.membershipid!, page.sort, page.id, page.fetch]);
      const response = keysetResult(result, page, 'bound_at', 'membership_id');
      return { ...response, body: StorefrontMemberInviteePageSchema.parse(response.body) };
    },
    'member.storefront.orders.read': async (request, database) => {
      const access = requireAccess(request);
      if (access.scope.kind !== 'mall') throw new Error('SCOPE_NOT_ALLOWED_FOR_OPERATION');
      const page = queryPage(request, 50);
      const result = await database.query(`with target as(
        select membership.member_id from access.membership membership
        where membership.id=$2 and membership.organization_id=$1 and membership.client='storefront'
      ) select orders.id,orders.order_number,orders.total_minor::text total_minor,orders.currency,
        orders.payment_state,orders.fulfillment_state,orders.aftersale_state,
        to_char(orders.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') created_at
        from target join ordering.orderrecord orders on orders.mall_id=$1 and orders.member_id=target.member_id
        where ($3::timestamptz is null or (orders.created_at,orders.id)<($3::timestamptz,$4))
        order by orders.created_at desc,orders.id desc limit $5`,
      [access.scope.id, request.input.path.membershipid!, page.sort, page.id, page.fetch]);
      const response = keysetResult(result, page, 'created_at', 'id');
      return { ...response, body: StorefrontMemberOrderPageSchema.parse(response.body) };
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
        invitation.accepted_membership_id,accepted_profile.display_name invitee_name,invitation.destination_masked,
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
            where boundary.ancestor_id=$1
              and boundary.descendant_id=coalesce(invitation.storefront_organization_id,invitation.organization_id))
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

async function withMemberIdentityDisplays<T extends Record<string, unknown>>(
  database: import('../../../foundation/application/ModuleOperations').OperationDatabase,
  contextId: string,
  rows: readonly T[],
): Promise<T[]> {
  const displays = await presentIdentityDisplays(database, contextId, 'member', rows.map((row) => ({
    membershipId: String(row.membership_id), maskedMobile: typeof row.mobile_masked === 'string' ? row.mobile_masked : null,
  })));
  return rows.map((row) => {
    const identityDisplay = displays.get(String(row.membership_id));
    return identityDisplay === undefined ? row : { ...row, identity_display: identityDisplay };
  });
}

export function memberOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('member', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    memberOperatorReadActions(context.container.get(KMS_CLIENT)), MEMBER_OPERATOR_READ_OPERATION_IDS);
}

interface OperatorDirectoryRow extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly membership_id: string;
  readonly directory_sort: string;
  readonly principal_id: string;
  readonly mobile_masked?: string | null;
  readonly mobile_ciphertext?: string | null;
}

function queryValue(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 100) ?? '';
}
