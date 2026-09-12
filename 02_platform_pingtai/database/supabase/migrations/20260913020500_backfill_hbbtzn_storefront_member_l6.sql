begin;

select pg_advisory_xact_lock(hashtext('identity:hbbtzn-storefront-member-l6-backfill:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260913015500'
        and checksum='572125b5e38fa541f9f90b202280fa1c38797dbf0dad5ae99dad691a7e0e54cf')
    or exists(select 1 from runtime.schemaversion where version>'20260913015500') then
    raise exception 'HBBTZN_STOREFRONT_MEMBER_L6_PREDECESSOR_INVALID';
  end if;
  if not exists(select 1 from organization.resolve_node_context('node:hbbtzn:l1') host
      where host.status='active' and host.node_profile='operating_mall' and host.signed_level='L1'
        and host.mall_id='mall:d1708f04df2dd8a61736852c4900fb43') then
    raise exception 'HBBTZN_STOREFRONT_MEMBER_L6_HOST_INVALID';
  end if;
end
$precondition$;

do $backfill$
declare
  target record;
  key_hash text;
begin
  for target in
    select membership.id membership_id,profile.principal_id,
      (select credential.subject_hash::text from identity.credential credential
        where credential.principal_id=profile.principal_id and credential.provider='password'
          and credential.status='active'
        order by credential.created_at desc,credential.id desc limit 1) business_identity_hash
    from access.membership membership
    join member.profile profile on profile.id=membership.member_id
    where membership.organization_id='mall:d1708f04df2dd8a61736852c4900fb43'
      and membership.client='storefront'
      and not exists(select 1 from organization.membernoderegistration registration
        where registration.membership_id=membership.id)
    order by membership.id
  loop
    if target.business_identity_hash is null or target.business_identity_hash!~'^[0-9a-f]{64}$' then
      raise exception 'HBBTZN_STOREFRONT_MEMBER_L6_IDENTITY_MISSING:%',target.membership_id;
    end if;
    key_hash:=encode(public.digest(convert_to(target.membership_id,'UTF8'),'sha256'),'hex');
    perform * from organization.register_hosted_member_node(jsonb_build_object(
      'registration_id','registration:backfill:hbbtzn:l6:'||key_hash,
      'business_number','SFLREG-BF-'||upper(left(key_hash,16)),
      'idempotency_key','migration:20260913020500:'||target.membership_id,
      'registration_origin','direct',
      'registration_host_node_id','node:hbbtzn:l1',
      'invitation_token_hash',null,
      'business_identity_hash',target.business_identity_hash,
      'node_key','member-'||left(key_hash,32),
      'realm_id','realm:member-'||key_hash,
      'membership_id',target.membership_id,
      'requested_by',target.principal_id,
      'trace_id','migration:20260913020500'
    ));
  end loop;
end
$backfill$;

insert into runtime.schemaversion(version,checksum)
values('20260913020500','609fc705fd733bad30053d7fb81fdaeee389cdc619ad3c2fabef84f97b5d7723');

do $assert$
begin
  if exists(
      select 1 from access.membership membership
      left join organization.membernoderegistration registration on registration.membership_id=membership.id
      left join organization.node node on node.id=registration.node_id and node.status='active'
      left join organization.noderelation relation on relation.node_id=node.id
        and relation.line_id=registration.line_id and relation.superseded_at is null
      where membership.organization_id='mall:d1708f04df2dd8a61736852c4900fb43'
        and membership.client='storefront'
        and (registration.registration_id is null or registration.registration_host_node_id<>'node:hbbtzn:l1'
          or node.node_profile<>'consumer' or relation.parent_node_id<>'node:hbbtzn:l1'
          or relation.signed_level<>'L6'))
    or not exists(select 1 from runtime.schemaversion where version='20260913020500'
      and checksum='609fc705fd733bad30053d7fb81fdaeee389cdc619ad3c2fabef84f97b5d7723') then
    raise exception 'HBBTZN_STOREFRONT_MEMBER_L6_BACKFILL_INCOMPLETE';
  end if;
end
$assert$;

commit;
