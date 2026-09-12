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
import { keysetResult, queryPage } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import { requireGovernanceContext } from '../../../foundation/security/AccessContext';

export const MEMBER_OPERATOR_READ_OPERATION_IDS = Object.freeze([
  'member.members.read',
  'member.storefront.members.read',
  'member.storefront.detail.read',
  'member.storefront.invitees.read',
  'member.storefront.orders.read',
  'member.invitations.read',
  'member.imports.read',
] as const satisfies readonly OperationId[]);

export function memberOperatorReadActions(): OperationActions {
  return {
    'member.members.read': async (request, database) => {
      const access = requireAccess(request);
      const governance = requireGovernanceContext(access);
      const page = queryPage(request);
      const result = await database.query(`with recursive governance_subtree(membership_id) as(
        select actor.id
        from access.membership actor
        where actor.id=$8 and actor.client='operator' and actor.status='active'
        union
        select child.id
        from access.membership child
        join governance_subtree parent on child.governance_parent_membership_id=parent.membership_id
        where child.client='operator' and child.status='active'
      ), anchor as(
        select distinct on(profile.id) profile.id,profile.principal_id,profile.display_name,profile.status,
          principal.version principal_version,principal.status principal_status,
          membership.id membership_id,membership.client,membership.employee_no,membership.status membership_status,
          membership.access_version,membership.joined_at,membership.governance_parent_membership_id,
          governance_parent_profile.display_name governance_parent_name,
          to_char(coalesce(membership.joined_at,to_timestamp(0)) at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') directory_sort
        from access.membership membership
        join member.profile profile on profile.id=membership.member_id
        join identity.principal principal on principal.id=profile.principal_id
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
        governance.isExactOwner, governance.actorMembershipId]);
      return keysetResult(result, page, 'directory_sort', 'id');
    },
    'member.storefront.members.read': async (request, database) => {
      const access = requireAccess(request);
      if (access.scope.kind !== 'mall') throw new Error('SCOPE_NOT_ALLOWED_FOR_OPERATION');
      const page = queryPage(request);
      const query = queryValue(request.input.query.q);
      const result = await database.query(`select membership.id membership_id,profile.display_name,profile.mobile_masked,
        relation.signed_level identity_level,node.node_profile identity_kind,
        membership.status membership_status,profile.mobile_token is not null mobile_bound,
        exists(select 1 from identity.federatedidentity identity
          where identity.membership_id=membership.id and identity.provider='wechat' and identity.status='active') wechat_bound,
        case when membership.joined_at is null then null else to_char(membership.joined_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end joined_at
        from access.membership membership
        join member.profile profile on profile.id=membership.member_id
        join organization.membernoderegistration registration on registration.membership_id=membership.id
        join organization.node node on node.id=registration.node_id and node.node_profile='consumer'
        join organization.noderelation relation on relation.node_id=node.id and relation.superseded_at is null
          and relation.signed_level in('L6','L7','L8','L9','L10','L11')
        where membership.organization_id=$1 and membership.client='storefront'
          and ($2='' or profile.display_name ilike '%'||$2||'%' or membership.id ilike '%'||$2||'%'
            or profile.mobile_masked ilike '%'||$2||'%')
          and ($3::text is null or membership.id<$3)
        order by membership.id desc limit $4`,
      [access.scope.id, query, page.sort, page.fetch]);
      const response = keysetResult(result, page, 'membership_id', 'membership_id');
      return { ...response, body: StorefrontMemberPageSchema.parse(response.body) };
    },
    'member.storefront.detail.read': async (request, database) => {
      const access = requireAccess(request);
      if (access.scope.kind !== 'mall') throw new Error('SCOPE_NOT_ALLOWED_FOR_OPERATION');
      const result = await database.query(`select membership.id membership_id,profile.display_name,profile.mobile_masked,
        relation.signed_level identity_level,node.node_profile identity_kind,
        membership.status membership_status,profile.mobile_token is not null mobile_bound,
        exists(select 1 from identity.federatedidentity identity
          where identity.membership_id=membership.id and identity.provider='wechat' and identity.status='active') wechat_bound,
        case when membership.joined_at is null then null else to_char(membership.joined_at at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end joined_at,
        case when inviter_binding.id is null then null else jsonb_build_object(
          'display_name',inviter_profile.display_name,'mobile_masked',inviter_profile.mobile_masked,
          'bound_at',to_char(inviter_binding.bound_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'expires_at',case when inviter_binding.expires_at is null then null else to_char(
            inviter_binding.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
          'relationship_status',case when inviter_binding.expires_at is not null
            and inviter_binding.expires_at<=clock_timestamp() then 'expired' else 'active' end) end inviter,
        jsonb_build_object(
          'kind',case parent_node.node_profile when 'consumer' then 'member' else 'mall' end,
          'display_name',case parent_node.node_profile when 'consumer' then parent_profile.display_name
            else parent_organization.name end,
          'identity_level',parent_relation.signed_level
        ) parent,
        coalesce((select count(*)::int from referral.member referral_owner
          join referral.binding invited_binding on invited_binding.scope_id=referral_owner.scope_id
            and invited_binding.referral_member_id=referral_owner.id
          join access.membership invited_membership on invited_membership.organization_id=membership.organization_id
            and invited_membership.client='storefront' and invited_membership.member_id=invited_binding.customer_member_id
          where referral_owner.scope_id=membership.organization_id and referral_owner.member_id=membership.member_id),0) invited_count,
        coalesce((select count(*)::int from ordering.orderrecord orders
          where orders.mall_id=membership.organization_id and orders.member_id=membership.member_id),0) order_count,
        (select to_char(max(orders.created_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          from ordering.orderrecord orders
          where orders.mall_id=membership.organization_id and orders.member_id=membership.member_id) latest_order_at
        from access.membership membership
        join member.profile profile on profile.id=membership.member_id
        join organization.membernoderegistration registration on registration.membership_id=membership.id
        join organization.node node on node.id=registration.node_id and node.node_profile='consumer'
        join organization.noderelation relation on relation.node_id=node.id and relation.superseded_at is null
          and relation.signed_level in('L6','L7','L8','L9','L10','L11')
        join organization.node parent_node on parent_node.id=relation.parent_node_id
        join organization.noderelation parent_relation on parent_relation.node_id=parent_node.id
          and parent_relation.superseded_at is null
        left join organization.membernoderegistration parent_registration on parent_registration.node_id=parent_node.id
        left join access.membership parent_membership on parent_membership.id=parent_registration.membership_id
          and parent_membership.organization_id=membership.organization_id and parent_membership.client='storefront'
        left join member.profile parent_profile on parent_profile.id=parent_membership.member_id
        left join organization.organization parent_organization on parent_organization.id=case
          when parent_node.node_profile='operating_mall' then membership.organization_id else parent_node.mall_id end
        left join lateral(select binding.* from referral.binding binding
          where binding.scope_id=membership.organization_id and binding.customer_member_id=membership.member_id
          order by binding.bound_at desc,binding.id desc limit 1) inviter_binding on true
        left join referral.member inviter_member on inviter_member.scope_id=inviter_binding.scope_id
          and inviter_member.id=inviter_binding.referral_member_id
        left join member.profile inviter_profile on inviter_profile.id=inviter_member.member_id
        where membership.id=$2 and membership.organization_id=$1 and membership.client='storefront'`,
      [access.scope.id, request.input.path.membershipid!]);
      const response = rowResult(result);
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
        invited_membership.status membership_status,invited_relation.signed_level identity_level,
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
        join organization.membernoderegistration invited_registration
          on invited_registration.membership_id=invited_membership.id
        join organization.noderelation invited_relation on invited_relation.node_id=invited_registration.node_id
          and invited_relation.superseded_at is null and invited_relation.signed_level in('L7','L8','L9','L10','L11')
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

export function memberOperatorReadOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations('member', context.container.get(DATABASE_POOL), context.container.get(AUDIT_SINK),
    memberOperatorReadActions(), MEMBER_OPERATOR_READ_OPERATION_IDS);
}

function queryValue(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 100) ?? '';
}
