/** Shared MB directory query; database selection remains with the calling node. */
export function buildMemberDirectoryQuery(
  scopeId: string,
  search: string,
  cursor: string | null,
  fetch: number,
  identityMembership: string | null,
) {
  return {
    text: `select membership.id membership_id,profile.display_name,profile.mobile_masked,
    member_context.signed_level identity_level,member_context.node_profile identity_kind,
    membership.status membership_status,profile.mobile_token is not null mobile_bound,
    exists(select 1 from identity.federatedidentity identity
      where identity.membership_id=membership.id and identity.provider='wechat' and identity.status='active') wechat_bound,
    case when membership.joined_at is null then null else to_char(membership.joined_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end joined_at
    from access.membership membership
    join member.profile profile on profile.id=membership.member_id
    join lateral identity.resolve_storefront_member_context(
      membership.id,membership.organization_id
    ) member_context on member_context.node_profile='consumer'
      and member_context.signed_level in('L6','L7','L8','L9','L10','L11')
    where membership.organization_id=$1 and membership.client='storefront'
      and ($2='' or profile.display_name ilike '%'||$2||'%' or membership.id ilike '%'||$2||'%'
        or profile.mobile_masked ilike '%'||$2||'%' or membership.id=$5)
      and ($3::text is null or membership.id<$3)
    order by membership.id desc limit $4`,
    values: [scopeId, search, cursor, fetch, identityMembership] as const,
  };
}
