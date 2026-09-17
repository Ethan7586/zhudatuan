import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

/** Existing scoped referral read; SQL remains outside the pure L-kernel. */
export function readMemberInvitees(
  database: OperationDatabase,
  scopeId: string,
  membershipId: string,
  cursorTime: string | null,
  cursorId: string | null,
  fetch: number,
) {
  return database.query(`with target as(
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
    [scopeId, membershipId, cursorTime, cursorId, fetch]);
}
