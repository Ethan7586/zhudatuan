begin;

select pg_advisory_xact_lock(hashtext('sfl:member-registration-progression:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260912010000' and checksum='ad04df36d3de44bec0b507e5af342395e1833bf04862be74679545c1cb0be26a')
    or exists(select 1 from runtime.schemaversion where version>'20260912010000') then
    raise exception 'SFL_MEMBER_REGISTRATION_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

create table organization.membernoderegistration(
  registration_id text primary key,
  business_number text not null unique,
  idempotency_key text not null unique,
  request_hash char(64) not null,
  business_identity_hash char(64) not null,
  registration_origin text not null check(registration_origin in('direct','invitation')),
  registration_host_node_id text not null,
  invitation_id text,
  inviter_node_id text,
  inviter_membership_id text,
  node_id text not null unique,
  line_id text not null,
  parent_node_id text not null,
  signed_level text not null check(signed_level~'^L(6|7|8|9|10|11)$'),
  relation_version bigint not null check(relation_version=1),
  host_sovereign_node_id text not null,
  realm_id text not null unique,
  membership_id text not null unique,
  effective_at timestamptz not null,
  accepted_at timestamptz not null,
  created_at timestamptz not null,
  requested_by text not null,
  trace_id text not null,
  unique(registration_host_node_id,business_identity_hash),
  foreign key(node_id,line_id) references organization.node(id,line_id),
  foreign key(line_id,node_id,relation_version) references organization.noderelation(line_id,node_id,relation_version),
  foreign key(realm_id) references identity.realm(id),
  check((registration_origin='direct' and invitation_id is null and inviter_node_id is null and inviter_membership_id is null)
    or (registration_origin='invitation' and invitation_id is not null and inviter_node_id=parent_node_id
      and inviter_membership_id is not null))
);

create table organization.memberregistrationboundary(
  registration_id text primary key,
  business_number text not null unique,
  idempotency_key text not null unique,
  request_hash char(64) not null,
  business_identity_hash char(64) not null,
  registration_origin text not null check(registration_origin='invitation'),
  registration_host_node_id text not null,
  invitation_id text not null,
  inviter_node_id text not null,
  inviter_membership_id text not null,
  line_id text not null,
  realm_id text not null,
  host_sovereign_node_id text not null,
  outcome text not null check(outcome='level_boundary'),
  created_at timestamptz not null,
  requested_by text not null,
  trace_id text not null,
  unique(invitation_id,business_identity_hash)
);

create function organization.register_hosted_member_node(p_request jsonb)
returns table(
  outcome text,registration_id text,business_number text,registration_origin text,
  registration_host_node_id text,invitation_id text,inviter_node_id text,inviter_membership_id text,
  node_id text,line_id text,parent_node_id text,signed_level text,relation_version integer,
  host_sovereign_node_id text,realm_id text,membership_id text,effective_at text,accepted_at text,
  idempotency_key text,request_hash text,created_at text,replayed boolean
)
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare
  v_registration_id text:=p_request->>'registration_id';
  v_business_number text:=p_request->>'business_number';
  v_idempotency_key text:=p_request->>'idempotency_key';
  v_origin text:=p_request->>'registration_origin';
  v_registration_host_node_id text:=p_request->>'registration_host_node_id';
  v_invitation_token_hash text:=p_request->>'invitation_token_hash';
  v_business_identity_hash text:=p_request->>'business_identity_hash';
  v_node_key text:=p_request->>'node_key';
  v_realm_id text:=p_request->>'realm_id';
  v_membership_id text:=p_request->>'membership_id';
  v_requested_by text:=p_request->>'requested_by';
  v_trace_id text:=p_request->>'trace_id';
  v_request_hash text;
  v_now timestamptz:=transaction_timestamp();
  v_effective_at_text text;
  v_host record;
  v_invite record;
  v_inviter record;
  v_parent_node_id text;
  v_host_sovereign_node_id text;
  v_invitation_id text;
  v_inviter_node_id text;
  v_inviter_membership_id text;
  v_target_level integer;
  v_target_level_text text;
  v_node_id text;
  v_existing organization.membernoderegistration%rowtype;
  v_existing_boundary organization.memberregistrationboundary%rowtype;
begin
  if jsonb_typeof(p_request)<>'object'
    or (select array_agg(key order by key) from jsonb_object_keys(p_request) key)
      <>array['business_identity_hash','business_number','idempotency_key','invitation_token_hash','membership_id',
        'node_key','realm_id','registration_host_node_id','registration_id','registration_origin','requested_by','trace_id']::text[] then
    raise exception 'SFL_MEMBER_REGISTRATION_REQUEST_INVALID';
  end if;
  if v_registration_id is null or v_registration_id='' or v_registration_id<>btrim(v_registration_id)
    or v_business_number is null or v_business_number='' or v_business_number<>btrim(v_business_number)
    or v_idempotency_key is null or v_idempotency_key='' or v_idempotency_key<>btrim(v_idempotency_key)
    or v_origin is null or v_origin not in('direct','invitation')
    or v_registration_host_node_id is null or v_registration_host_node_id='' or v_registration_host_node_id<>btrim(v_registration_host_node_id)
    or v_business_identity_hash is null or v_business_identity_hash!~'^[0-9a-f]{64}$'
    or v_node_key is null or v_node_key!~'^[a-z0-9][a-z0-9-]{0,50}$'
    or v_realm_id is null or v_realm_id='' or v_realm_id<>btrim(v_realm_id)
    or v_membership_id is null or v_membership_id='' or v_membership_id<>btrim(v_membership_id)
    or v_requested_by is null or v_requested_by='' or v_requested_by<>btrim(v_requested_by)
    or v_trace_id is null or v_trace_id='' or v_trace_id<>btrim(v_trace_id)
    or (v_origin='direct')<>(v_invitation_token_hash is null)
    or (v_invitation_token_hash is not null and v_invitation_token_hash!~'^[0-9a-f]{64}$') then
    raise exception 'SFL_MEMBER_REGISTRATION_REQUEST_INVALID';
  end if;

  v_request_hash:=encode(public.digest(convert_to(jsonb_build_object(
    'business_identity_hash',v_business_identity_hash,
    'registration_origin',v_origin,
    'registration_host_node_id',v_registration_host_node_id,
    'invitation_token_hash',v_invitation_token_hash
  )::text,'UTF8'),'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('sfl:member-registration:idempotency:'||v_idempotency_key,0));

  select registration.* into v_existing from organization.membernoderegistration registration
  where registration.idempotency_key=v_idempotency_key;
  if found then
    if v_existing.request_hash<>v_request_hash then raise exception 'SFL_MEMBER_REGISTRATION_IDEMPOTENCY_KEY_REUSED'; end if;
    return query select 'registered',v_existing.registration_id,v_existing.business_number,v_existing.registration_origin,
      v_existing.registration_host_node_id,v_existing.invitation_id,v_existing.inviter_node_id,v_existing.inviter_membership_id,
      v_existing.node_id,v_existing.line_id,v_existing.parent_node_id,v_existing.signed_level,v_existing.relation_version::integer,
      v_existing.host_sovereign_node_id,v_existing.realm_id,v_existing.membership_id,
      to_char(v_existing.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      to_char(v_existing.accepted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      v_existing.idempotency_key,v_existing.request_hash::text,
      to_char(v_existing.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),true;
    return;
  end if;
  select boundary.* into v_existing_boundary from organization.memberregistrationboundary boundary
  where boundary.idempotency_key=v_idempotency_key;
  if found then
    if v_existing_boundary.request_hash<>v_request_hash then raise exception 'SFL_MEMBER_REGISTRATION_IDEMPOTENCY_KEY_REUSED'; end if;
    return query select v_existing_boundary.outcome,v_existing_boundary.registration_id,v_existing_boundary.business_number,
      v_existing_boundary.registration_origin,v_existing_boundary.registration_host_node_id,v_existing_boundary.invitation_id,
      v_existing_boundary.inviter_node_id,v_existing_boundary.inviter_membership_id,null::text,v_existing_boundary.line_id,
      null::text,null::text,null::integer,v_existing_boundary.host_sovereign_node_id,v_existing_boundary.realm_id,null::text,
      null::text,null::text,v_existing_boundary.idempotency_key,v_existing_boundary.request_hash::text,
      to_char(v_existing_boundary.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),true;
    return;
  end if;

  select resolved.* into v_host from organization.resolve_node_context(v_registration_host_node_id) resolved;
  if not found or v_host.status<>'active' or v_host.node_profile<>'operating_mall'
    or v_host.signed_level!~'^L([0-5])$' or v_host.mall_id is null then
    raise exception 'SFL_MEMBER_REGISTRATION_HOST_INVALID';
  end if;

  if v_origin='direct' then
    v_parent_node_id:=v_host.node_id;
    v_host_sovereign_node_id:=v_host.host_sovereign_node_id;
    v_target_level:=6;
  else
    select invite.id,invite.organization_id,invite.created_by into v_invite
    from member.invite invite
    join identity.registrationpolicy policy on policy.id=invite.registration_policy_id
    join organization.organization organization on organization.id=invite.organization_id
    where invite.token_hash=v_invitation_token_hash and invite.status='active'
      and invite.effective_at<=clock_timestamp() and invite.expires_at>clock_timestamp()
      and invite.use_count<invite.max_uses
      and (invite.allowed_destination_hash is null or invite.allowed_destination_hash=v_business_identity_hash)
      and invite.target_client='storefront' and invite.storefront_organization_id is null
      and invite.organization_id=v_host.mall_id and organization.kind='mall' and organization.status='active'
      and access.registration_invite_role_allowed(invite.role_id,invite.organization_id,invite.target_client)
      and policy.effective_at<=clock_timestamp() and (policy.retired_at is null or policy.retired_at>clock_timestamp())
      and policy.terms_hash=invite.terms_hash
    for update of invite;
    if not found then raise exception 'INVITE_INVALID'; end if;
    select resolved.*,membership.id inviter_membership_id into v_inviter
    from access.membership membership
    join identity.realm realm on realm.id=membership.realm_id and realm.status='active'
    cross join lateral organization.resolve_node_context(realm.node_id) resolved
    where membership.id=v_invite.created_by and membership.status='active' and membership.client='storefront'
      and membership.organization_id=v_invite.organization_id;
    if not found or v_inviter.status<>'active' or v_inviter.line_id<>v_host.line_id
      or v_inviter.signed_level!~'^L(6|7|8|9|10|11)$' then
      raise exception 'INVITE_INVALID';
    end if;
    v_invitation_id:=v_invite.id;
    v_inviter_node_id:=v_inviter.node_id;
    v_inviter_membership_id:=v_inviter.inviter_membership_id;
    v_host_sovereign_node_id:=v_inviter.host_sovereign_node_id;
    if v_inviter.signed_level='L11' then
      insert into organization.memberregistrationboundary(
        registration_id,business_number,idempotency_key,request_hash,business_identity_hash,registration_origin,
        registration_host_node_id,invitation_id,inviter_node_id,inviter_membership_id,line_id,realm_id,
        host_sovereign_node_id,outcome,created_at,requested_by,trace_id
      ) values(
        v_registration_id,v_business_number,v_idempotency_key,v_request_hash,v_business_identity_hash,'invitation',
        v_host.node_id,v_invitation_id,v_inviter_node_id,v_inviter_membership_id,v_host.line_id,v_host.realm_id,
        v_inviter.host_sovereign_node_id,'level_boundary',v_now,v_requested_by,v_trace_id
      );
      return query select 'level_boundary',v_registration_id,v_business_number,'invitation',v_host.node_id,v_invitation_id,
        v_inviter_node_id,v_inviter_membership_id,null::text,v_host.line_id,null::text,null::text,null::integer,
        v_inviter.host_sovereign_node_id,v_host.realm_id,null::text,null::text,null::text,v_idempotency_key,v_request_hash,
        to_char(v_now at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),false;
      return;
    end if;
    v_parent_node_id:=v_inviter_node_id;
    v_target_level:=substring(v_inviter.signed_level from 2)::integer+1;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'sfl:member-registration:identity:'||v_host.node_id||':'||v_business_identity_hash,0));
  if exists(select 1 from organization.membernoderegistration registration
      where registration.registration_host_node_id=v_host.node_id
        and registration.business_identity_hash=v_business_identity_hash) then
    raise exception 'SFL_MEMBER_REGISTRATION_IDENTITY_CONFLICT';
  end if;

  v_target_level_text:='L'||v_target_level;
  v_node_id:='node:'||v_node_key||':l'||v_target_level;
  v_effective_at_text:=to_char(v_now at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  insert into identity.realm(
    id,node_id,status,created_at,updated_at,version,node_profile,mall_id,host_node_id,host_node_profile
  ) values(
    v_realm_id,v_node_id,'active',v_now,v_now,0,'consumer',null,
    v_host_sovereign_node_id,
    'operating_mall'
  );
  perform organization.provision_hosted_node(jsonb_build_object(
    'idempotency_key','member-registration:'||v_idempotency_key,
    'node_id',v_node_id,
    'parent_node_id',v_parent_node_id,
    'realm_id',v_realm_id,
    'node_profile','consumer',
    'mall_id',null,
    'signed_level',v_target_level_text,
    'effective_at',v_effective_at_text,
    'requested_by',v_requested_by,
    'trace_id',v_trace_id
  ));

  if v_origin='invitation' then
    update member.invite invite set use_count=invite.use_count+1,
      accepted_at=case when invite.use_count+1=invite.max_uses then v_now else invite.accepted_at end,
      version=invite.version+1
    where invite.id=v_invitation_id;
  end if;
  insert into organization.membernoderegistration(
    registration_id,business_number,idempotency_key,request_hash,business_identity_hash,registration_origin,
    registration_host_node_id,invitation_id,inviter_node_id,inviter_membership_id,node_id,line_id,parent_node_id,
    signed_level,relation_version,host_sovereign_node_id,realm_id,membership_id,effective_at,accepted_at,created_at,
    requested_by,trace_id
  ) values(
    v_registration_id,v_business_number,v_idempotency_key,v_request_hash,v_business_identity_hash,v_origin,
    v_host.node_id,v_invitation_id,v_inviter_node_id,v_inviter_membership_id,
    v_node_id,v_host.line_id,v_parent_node_id,v_target_level_text,1,
    v_host_sovereign_node_id,
    v_realm_id,v_membership_id,v_now,v_now,v_now,v_requested_by,v_trace_id
  );

  return query select 'registered',v_registration_id,v_business_number,v_origin,v_host.node_id,
    v_invitation_id,v_inviter_node_id,v_inviter_membership_id,
    v_node_id,v_host.line_id,v_parent_node_id,v_target_level_text,1,
    v_host_sovereign_node_id,
    v_realm_id,v_membership_id,v_effective_at_text,v_effective_at_text,v_idempotency_key,v_request_hash,v_effective_at_text,false;
end
$function$;

revoke all on organization.membernoderegistration,organization.memberregistrationboundary from public;
revoke all on function organization.register_hosted_member_node(jsonb) from public;
grant usage on schema organization to zhudatuanidentityapi;
grant execute on function organization.register_hosted_member_node(jsonb) to zhudatuanidentityapi;

insert into runtime.schemaversion(version,checksum)
values('20260912020000','6b59e2b70262b770755189b8dce32b50d43ce818b8d9fe153c55ef3a7b8d9a8b');

do $assert$
begin
  if to_regclass('organization.membernoderegistration') is null
    or to_regclass('organization.memberregistrationboundary') is null
    or to_regprocedure('organization.register_hosted_member_node(jsonb)') is null
    or has_function_privilege('public','organization.register_hosted_member_node(jsonb)','execute')
    or not has_function_privilege('zhudatuanidentityapi','organization.register_hosted_member_node(jsonb)','execute')
    or has_table_privilege('zhudatuanidentityapi','organization.membernoderegistration','select,insert,update,delete')
    or has_table_privilege('zhudatuanidentityapi','organization.memberregistrationboundary','select,insert,update,delete')
    or not exists(select 1 from runtime.schemaversion where version='20260912020000'
      and checksum='6b59e2b70262b770755189b8dce32b50d43ce818b8d9fe153c55ef3a7b8d9a8b') then
    raise exception 'SFL_MEMBER_REGISTRATION_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
