import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export function readMemberDetail(database: OperationDatabase, scopeId: string, membershipId: string) {
  return database.query(`select membership.id membership_id,profile.display_name,profile.mobile_masked,
        member_context.signed_level identity_level,member_context.node_profile identity_kind,
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
          'kind',member_context.parent_kind,
          'display_name',member_context.parent_display_name,
          'identity_level',member_context.parent_signed_level
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
        join lateral identity.resolve_storefront_member_context(
          membership.id,membership.organization_id
        ) member_context on member_context.node_profile='consumer'
          and member_context.signed_level in('L6','L7','L8','L9','L10','L11')
        left join lateral(select binding.* from referral.binding binding
          where binding.scope_id=membership.organization_id and binding.customer_member_id=membership.member_id
          order by binding.bound_at desc,binding.id desc limit 1) inviter_binding on true
        left join referral.member inviter_member on inviter_member.scope_id=inviter_binding.scope_id
          and inviter_member.id=inviter_binding.referral_member_id
        left join member.profile inviter_profile on inviter_profile.id=inviter_member.member_id
        where membership.id=$2 and membership.organization_id=$1 and membership.client='storefront'`,
      [scopeId, membershipId]);
}
