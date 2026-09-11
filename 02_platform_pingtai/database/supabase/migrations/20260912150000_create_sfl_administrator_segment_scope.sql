begin;

select pg_advisory_xact_lock(hashtext('sfl:administrator-segment-scope:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260912050000' and checksum='1cd685bc700d26773ffd1c5937c908cb5bff4d61d7c2c07a185da16dc7d5f899') then
    raise exception 'SFL_ADMIN_SEGMENT_SCOPE_PREDECESSOR_INVALID';
  end if;
  if to_regclass('access.administratoridentity') is not null then
    raise exception 'SFL_ADMIN_SEGMENT_SCOPE_TARGET_EXISTS';
  end if;
end
$precondition$;

create table access.administratoridentity(
  id text primary key,
  membership_id text not null unique references access.membership(id),
  realm_id text not null,
  account_id text not null,
  principal_id text not null,
  host_node_id text not null references organization.node(id),
  status text not null check(status in('active','revoked')),
  version bigint not null check(version>0),
  created_at timestamptz not null,
  revoked_at timestamptz,
  foreign key(account_id,realm_id) references identity.account(id,realm_id),
  unique(id,realm_id),
  check((status='active')=(revoked_at is null))
);

create table access.administratorsegmentscope(
  scope_id text primary key,
  administrator_identity_id text not null,
  scope_version bigint not null check(scope_version>0),
  realm_id text not null,
  line_id text not null,
  root_node_id text not null,
  segment text not null check(segment in('first_segment','second_segment','both_segments')),
  role_id text not null references access.role(id),
  access_version bigint not null check(access_version>0),
  status text not null check(status in('active','revoked')),
  effective_at timestamptz not null,
  revoked_at timestamptz,
  granted_by_administrator_identity_id text not null references access.administratoridentity(id),
  foreign key(administrator_identity_id,realm_id) references access.administratoridentity(id,realm_id),
  foreign key(root_node_id,line_id) references organization.node(id,line_id),
  unique(administrator_identity_id,scope_version),
  check((status='active')=(revoked_at is null))
);

create unique index access_administratorsegmentscope_one_active
  on access.administratorsegmentscope(administrator_identity_id) where status='active';
create index access_administratorsegmentscope_boundary
  on access.administratorsegmentscope(realm_id,line_id,root_node_id,segment) where status='active';

create table access.administratorsegmentchange(
  change_id text primary key,
  business_number text not null unique,
  idempotency_key text not null unique,
  request_hash char(64) not null,
  actor_administrator_identity_id text not null references access.administratoridentity(id),
  administrator_identity_id text not null references access.administratoridentity(id),
  administrator_membership_id text not null references access.membership(id),
  role_id text not null references access.role(id),
  action text not null check(action in('grant','replace','revoke')),
  previous_scope_version bigint,
  resulting_scope_version bigint,
  resulting_access_version bigint not null,
  created_at timestamptz not null
);

create table access.administratormembernote(
  note_id text primary key,
  business_number text not null unique,
  idempotency_key text not null unique,
  request_hash char(64) not null,
  administrator_identity_id text not null references access.administratoridentity(id),
  administrator_scope_id text not null references access.administratorsegmentscope(scope_id),
  administrator_scope_version bigint not null,
  target_node_id text not null references organization.node(id),
  note text not null,
  created_at timestamptz not null
);

create function access.resolve_administrator_context(p_membership_id text)
returns table(
  administrator_identity_id text,administrator_identity_version bigint,active_membership_id text,
  account_id text,principal_id text,realm_id text,host_node_id text,role_kind text,
  role_ids text[],permissions text[],scope_id text,scope_version bigint,line_id text,
  root_node_id text,segment text,access_version bigint,effective_at timestamptz
)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select identity.id,identity.version,membership.id,membership.account_id,account.legacy_principal_id,
    membership.realm_id,identity.host_node_id,
    case
      when exists(select 1 from access.membershiprole assignment where assignment.membership_id=membership.id
        and assignment.role_id='role-platform-owner-v2' and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())) then 'owner'
      when exists(select 1 from access.membershiprole assignment where assignment.membership_id=membership.id
        and assignment.role_id like 'role-senior-administrator-v1:%' and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())) then 'senior_administrator'
      else 'administrator'
    end,
    array(select distinct assignment.role_id from access.membershiprole assignment
      join access.role role on role.id=assignment.role_id and role.status='active'
      where assignment.membership_id=membership.id and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()) order by assignment.role_id),
    array(select distinct permission.code from access.membershiprole assignment
      join access.role role on role.id=assignment.role_id and role.status='active'
      join access.rolepermission mapping on mapping.role_id=role.id and mapping.effect='allow'
      join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
      where assignment.membership_id=membership.id and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()) order by permission.code),
    scope.scope_id,scope.scope_version,scope.line_id,scope.root_node_id,scope.segment,
    membership.access_version,scope.effective_at
  from access.membership membership
  join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
    and account.status='active'
  join access.administratoridentity identity on identity.membership_id=membership.id
    and identity.realm_id=membership.realm_id and identity.account_id=membership.account_id and identity.status='active'
  join access.administratorsegmentscope scope on scope.administrator_identity_id=identity.id
    and scope.realm_id=identity.realm_id and scope.status='active' and scope.access_version=membership.access_version
  where membership.id=p_membership_id and membership.client='operator' and membership.status='active'
$function$;

create function access.administrator_member_visible(p_membership_id text,p_target_node_id text)
returns boolean
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select exists(
    select 1
    from access.resolve_administrator_context(p_membership_id) administrator
    join organization.nodeclosure closure on closure.line_id=administrator.line_id
      and closure.ancestor_node_id=administrator.root_node_id and closure.descendant_node_id=p_target_node_id
      and closure.superseded_at is null
    join organization.node node on node.id=closure.descendant_node_id and node.line_id=closure.line_id and node.status='active'
    join organization.noderelation relation on relation.node_id=node.id and relation.line_id=node.line_id
      and relation.superseded_at is null
    where relation.signed_level~'^L([0-9]|10|11)$'
      and case administrator.segment
        when 'first_segment' then substring(relation.signed_level from 2)::integer between 0 and 5
        when 'second_segment' then substring(relation.signed_level from 2)::integer between 6 and 11
        when 'both_segments' then substring(relation.signed_level from 2)::integer between 0 and 11
        else false
      end
  )
$function$;

create function access.list_administrator_members(p_membership_id text,p_after_node_id text,p_limit integer)
returns table(
  node_id text,realm_id text,line_id text,parent_node_id text,signed_level text,node_profile text,
  mall_id text,relation_version integer,administrator_identity_id text,administrator_scope_version bigint
)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select node.id,node.realm_id,node.line_id,relation.parent_node_id,relation.signed_level,node.node_profile,
    node.mall_id,relation.relation_version::integer,administrator.administrator_identity_id,
    administrator.scope_version
  from access.resolve_administrator_context(p_membership_id) administrator
  join organization.nodeclosure closure on closure.line_id=administrator.line_id
    and closure.ancestor_node_id=administrator.root_node_id and closure.superseded_at is null
  join organization.node node on node.id=closure.descendant_node_id and node.line_id=closure.line_id and node.status='active'
  join organization.noderelation relation on relation.node_id=node.id and relation.line_id=node.line_id
    and relation.superseded_at is null
  where (p_after_node_id is null or node.id>p_after_node_id)
    and relation.signed_level~'^L([0-9]|10|11)$'
    and case administrator.segment
      when 'first_segment' then substring(relation.signed_level from 2)::integer between 0 and 5
      when 'second_segment' then substring(relation.signed_level from 2)::integer between 6 and 11
      when 'both_segments' then substring(relation.signed_level from 2)::integer between 0 and 11
      else false
    end
  order by node.id limit greatest(1,least(p_limit,500))
$function$;

create function access.read_administrator_member(p_membership_id text,p_target_node_id text)
returns table(
  node_id text,realm_id text,line_id text,parent_node_id text,signed_level text,node_profile text,
  mall_id text,relation_version integer,administrator_identity_id text,administrator_scope_version bigint
)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select member.* from access.list_administrator_members(p_membership_id,null,500) member
  where member.node_id=p_target_node_id
$function$;

create function access.change_administrator_segment_scope(
  p_actor_membership_id text,p_target_membership_id text,p_expected_access_version bigint,p_request jsonb
)
returns table(
  business_number text,administrator_identity_id text,administrator_membership_id text,role_id text,
  action text,scope_id text,scope_version bigint,realm_id text,line_id text,root_node_id text,
  segment text,access_version bigint,effective_at timestamptz,replayed boolean
)
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare
  v_actor record;
  v_target record;
  v_root record;
  v_existing access.administratorsegmentchange%rowtype;
  v_identity access.administratoridentity%rowtype;
  v_prior access.administratorsegmentscope%rowtype;
  v_action text:=p_request->>'action';
  v_role_id text:=p_request->>'role_id';
  v_segment text:=p_request->>'segment';
  v_root_node_id text:=p_request->>'root_node_id';
  v_idempotency_key text:=p_request->>'idempotency_key';
  v_trace_id text:=p_request->>'trace_id';
  v_request_hash text:=encode(public.digest(p_request::text,'sha256'),'hex');
  v_now timestamptz:=clock_timestamp();
  v_scope_version bigint;
  v_access_version bigint;
  v_scope_id text;
  v_change_id text;
  v_business_number text;
begin
  if v_action not in('grant','replace','revoke') or v_segment not in('first_segment','second_segment','both_segments')
    or nullif(v_role_id,'') is null or nullif(v_root_node_id,'') is null or nullif(v_idempotency_key,'') is null
    or p_request<>jsonb_strip_nulls(jsonb_build_object('action',v_action,'role_id',v_role_id,'segment',v_segment,
      'root_node_id',v_root_node_id,'idempotency_key',v_idempotency_key,'trace_id',v_trace_id)) then
    raise exception 'SFL_ADMIN_SCOPE_REQUEST_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target_membership_id,0));
  select * into v_existing from access.administratorsegmentchange where idempotency_key=v_idempotency_key;
  if found then
    if v_existing.request_hash<>v_request_hash then raise exception 'SFL_ADMIN_SCOPE_IDEMPOTENCY_KEY_REUSED'; end if;
    return query select v_existing.business_number,v_existing.administrator_identity_id,
      v_existing.administrator_membership_id,v_existing.role_id,v_existing.action,scope.scope_id,scope.scope_version,
      scope.realm_id,scope.line_id,scope.root_node_id,scope.segment,v_existing.resulting_access_version,
      coalesce(scope.effective_at,v_existing.created_at),true
    from (select 1) replay left join access.administratorsegmentscope scope
      on scope.administrator_identity_id=v_existing.administrator_identity_id
      and scope.scope_version=v_existing.resulting_scope_version;
    return;
  end if;

  select * into v_actor from access.resolve_administrator_context(p_actor_membership_id);
  if not found or not ('access.scope.manage'=any(v_actor.permissions)) then raise exception 'SFL_ADMIN_SCOPE_ACTOR_FORBIDDEN'; end if;

  select membership.id,membership.realm_id,membership.account_id,membership.access_version,
    account.legacy_principal_id principal_id,node.id host_node_id
  into v_target
  from access.membership membership
  join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
    and account.status='active'
  join organization.node node on node.realm_id=membership.realm_id and node.status='active'
  where membership.id=p_target_membership_id and membership.client='operator' and membership.status='active'
  for update of membership;
  if not found or v_target.realm_id<>v_actor.realm_id or v_target.access_version<>p_expected_access_version then
    raise exception 'SFL_ADMIN_SCOPE_TARGET_INVALID';
  end if;
  select node.id,node.line_id into v_root from organization.node node
  where node.id=v_root_node_id and node.status='active';
  if not found or v_root.line_id<>v_actor.line_id
    or not access.administrator_member_visible(p_actor_membership_id,v_root_node_id)
    or (v_actor.segment='first_segment' and v_segment<>'first_segment')
    or (v_actor.segment='second_segment' and v_segment<>'second_segment') then
    raise exception 'SFL_ADMIN_SCOPE_BOUNDARY_DENIED';
  end if;
  if not exists(select 1 from access.role role join access.rolepermission mapping on mapping.role_id=role.id and mapping.effect='allow'
      join access.permission permission on permission.id=mapping.permission_id and permission.code='member.read' and permission.status='active'
      where role.id=v_role_id and role.status='active') then raise exception 'SFL_ADMIN_ROLE_INVALID'; end if;

  select * into v_identity from access.administratoridentity where membership_id=p_target_membership_id for update;
  if not found then
    insert into access.administratoridentity(id,membership_id,realm_id,account_id,principal_id,host_node_id,status,version,created_at)
    values('administrator:'||encode(public.digest(p_target_membership_id,'sha256'),'hex'),p_target_membership_id,
      v_target.realm_id,v_target.account_id,v_target.principal_id,v_target.host_node_id,'active',1,v_now)
    returning * into v_identity;
  elsif v_identity.realm_id<>v_target.realm_id or v_identity.account_id<>v_target.account_id
      or v_identity.principal_id<>v_target.principal_id then
    raise exception 'SFL_ADMIN_IDENTITY_BINDING_MISMATCH';
  end if;

  select * into v_prior from access.administratorsegmentscope prior_scope
  where prior_scope.administrator_identity_id=v_identity.id and prior_scope.status='active' for update;
  if v_action='grant' and found then raise exception 'SFL_ADMIN_SCOPE_ALREADY_ACTIVE'; end if;
  if v_action in('replace','revoke') and not found then raise exception 'SFL_ADMIN_SCOPE_NOT_ACTIVE'; end if;

  if v_prior.scope_id is not null then
    update access.administratorsegmentscope prior_scope set status='revoked',revoked_at=v_now
    where prior_scope.scope_id=v_prior.scope_id;
  end if;
  v_scope_version:=coalesce((select max(scope.scope_version) from access.administratorsegmentscope scope
    where scope.administrator_identity_id=v_identity.id),0)+1;
  v_access_version:=v_target.access_version+1;
  if v_action<>'revoke' then
    v_scope_id:='admin-scope:'||encode(public.digest(v_identity.id||':'||v_scope_version::text,'sha256'),'hex');
    insert into access.administratorsegmentscope(
      scope_id,administrator_identity_id,scope_version,realm_id,line_id,root_node_id,segment,role_id,
      access_version,status,effective_at,granted_by_administrator_identity_id
    ) values(v_scope_id,v_identity.id,v_scope_version,v_target.realm_id,v_root.line_id,v_root_node_id,v_segment,v_role_id,
      v_access_version,'active',v_now,v_actor.administrator_identity_id);
    update access.administratoridentity set status='active',revoked_at=null,version=version+1 where id=v_identity.id;
    insert into access.membershiprole(membership_id,role_id,effective_at,expires_at,delegated_by)
    select p_target_membership_id,v_role_id,v_now,null,p_actor_membership_id
    where not exists(select 1 from access.membershiprole assignment where assignment.membership_id=p_target_membership_id
      and assignment.role_id=v_role_id and assignment.effective_at<=v_now
      and (assignment.expires_at is null or assignment.expires_at>v_now));
  else
    update access.administratoridentity set status='revoked',revoked_at=v_now,version=version+1 where id=v_identity.id;
    update access.membershiprole assignment set expires_at=v_now
    where assignment.membership_id=p_target_membership_id and assignment.role_id=v_role_id
      and assignment.effective_at<=v_now and (assignment.expires_at is null or assignment.expires_at>v_now);
  end if;
  update access.membership target_membership set access_version=v_access_version
  where target_membership.id=p_target_membership_id;

  if current_setting('sfl.admin_scope_interrupt',true)='after-scope' then
    raise exception 'SFL_ADMIN_SCOPE_TEST_INTERRUPT';
  end if;

  v_change_id:='admin-change:'||encode(public.digest(v_idempotency_key,'sha256'),'hex');
  v_business_number:='SFL-ADMIN-'||upper(substr(encode(public.digest(v_change_id,'sha256'),'hex'),1,16));
  insert into access.administratorsegmentchange(
    change_id,business_number,idempotency_key,request_hash,actor_administrator_identity_id,
    administrator_identity_id,administrator_membership_id,role_id,action,previous_scope_version,
    resulting_scope_version,resulting_access_version,created_at
  ) values(v_change_id,v_business_number,v_idempotency_key,v_request_hash,v_actor.administrator_identity_id,
    v_identity.id,p_target_membership_id,v_role_id,v_action,v_prior.scope_version,
    case when v_action='revoke' then null else v_scope_version end,v_access_version,v_now);
  insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
  values('event:'||encode(public.digest(v_change_id,'sha256'),'hex'),'access.administrator.scope.changed',1,'administrator',
    v_identity.id,v_root_node_id,jsonb_build_object('business_number',v_business_number,'action',v_action,
      'administrator_identity_id',v_identity.id,'administrator_membership_id',p_target_membership_id,
      'role_id',v_role_id,'scope_version',case when v_action='revoke' then null else v_scope_version end,
      'access_version',v_access_version),coalesce(v_trace_id,v_change_id),v_now,v_now);
  return query select v_business_number,v_identity.id,p_target_membership_id,v_role_id,v_action,v_scope_id,
    case when v_action='revoke' then null else v_scope_version end,v_target.realm_id,v_root.line_id,v_root_node_id,
    v_segment,v_access_version,v_now,false;
end
$function$;

create function access.record_administrator_member_note(
  p_actor_membership_id text,p_administrator_identity_id text,p_scope_version bigint,
  p_target_node_id text,p_idempotency_key text,p_note text,p_trace_id text
)
returns table(
  business_number text,note_id text,target_node_id text,administrator_identity_id text,
  administrator_scope_version bigint,created_at timestamptz,replayed boolean
)
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare
  v_actor record;
  v_existing access.administratormembernote%rowtype;
  v_hash text:=encode(public.digest(jsonb_build_object('target_node_id',p_target_node_id,'note',p_note)::text,'sha256'),'hex');
  v_note_id text:='admin-note:'||encode(public.digest(p_idempotency_key,'sha256'),'hex');
  v_business_number text:='SFL-NOTE-'||upper(substr(encode(public.digest(p_idempotency_key,'sha256'),'hex'),1,16));
  v_now timestamptz:=clock_timestamp();
begin
  select * into v_existing from access.administratormembernote where idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_hash<>v_hash then raise exception 'SFL_ADMIN_NOTE_IDEMPOTENCY_KEY_REUSED'; end if;
    return query select v_existing.business_number,v_existing.note_id,v_existing.target_node_id,
      v_existing.administrator_identity_id,v_existing.administrator_scope_version,v_existing.created_at,true;
    return;
  end if;
  select * into v_actor from access.resolve_administrator_context(p_actor_membership_id);
  if not found or v_actor.administrator_identity_id<>p_administrator_identity_id or v_actor.scope_version<>p_scope_version
    or not ('member.manage'=any(v_actor.permissions))
    or not access.administrator_member_visible(p_actor_membership_id,p_target_node_id) then
    raise exception 'SFL_ADMIN_MEMBER_WRITE_DENIED';
  end if;
  insert into access.administratormembernote(
    note_id,business_number,idempotency_key,request_hash,administrator_identity_id,administrator_scope_id,
    administrator_scope_version,target_node_id,note,created_at
  ) values(v_note_id,v_business_number,p_idempotency_key,v_hash,p_administrator_identity_id,v_actor.scope_id,
    p_scope_version,p_target_node_id,p_note,v_now);
  insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
  values('event:'||encode(public.digest(v_note_id,'sha256'),'hex'),'access.administrator.member.noted',1,'member_node',
    p_target_node_id,v_actor.root_node_id,jsonb_build_object('business_number',v_business_number,'note_id',v_note_id,
      'target_node_id',p_target_node_id,'administrator_identity_id',p_administrator_identity_id,
      'administrator_scope_version',p_scope_version),coalesce(p_trace_id,v_note_id),v_now,v_now);
  return query select v_business_number,v_note_id,p_target_node_id,p_administrator_identity_id,p_scope_version,v_now,false;
end
$function$;

insert into access.administratoridentity(
  id,membership_id,realm_id,account_id,principal_id,host_node_id,status,version,created_at
)
select 'administrator:'||encode(public.digest(membership.id,'sha256'),'hex'),membership.id,membership.realm_id,
  membership.account_id,account.legacy_principal_id,node.id,'active',1,clock_timestamp()
from access.membership membership
join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
join organization.node node on node.realm_id=membership.realm_id
where membership.client='operator' and membership.status='active' and exists(
  select 1 from access.membershiprole assignment join access.role role on role.id=assignment.role_id and role.status='active'
  where assignment.membership_id=membership.id and assignment.role_id<>'role:self'
    and assignment.effective_at<=clock_timestamp() and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
);

with projected as(
  insert into access.administratorsegmentscope(
    scope_id,administrator_identity_id,scope_version,realm_id,line_id,root_node_id,segment,role_id,
    access_version,status,effective_at,granted_by_administrator_identity_id
  )
  select 'admin-scope:'||encode(public.digest(identity.id||':1','sha256'),'hex'),identity.id,1,identity.realm_id,
    node.line_id,node.id,'both_segments',assignment.role_id,membership.access_version+1,'active',clock_timestamp(),identity.id
  from access.administratoridentity identity
  join access.membership membership on membership.id=identity.membership_id
  join organization.node node on node.id=identity.host_node_id
  join lateral(
    select assignment.role_id from access.membershiprole assignment
    where assignment.membership_id=membership.id and assignment.effective_at<=clock_timestamp()
      and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
      and (assignment.role_id='role-platform-owner-v2' or assignment.role_id like 'role-senior-administrator-v1:%'
        or assignment.role_id like 'role-l1-owner-v1:%')
    order by case when assignment.role_id='role-platform-owner-v2' then 0 else 1 end limit 1
  ) assignment on true
  returning administrator_identity_id,access_version
)
update access.membership membership set access_version=projected.access_version
from projected join access.administratoridentity identity on identity.id=projected.administrator_identity_id
where membership.id=identity.membership_id;

revoke all on access.administratoridentity,access.administratorsegmentscope,
  access.administratorsegmentchange,access.administratormembernote from public;
revoke all on function access.resolve_administrator_context(text) from public;
revoke all on function access.administrator_member_visible(text,text) from public;
revoke all on function access.list_administrator_members(text,text,integer) from public;
revoke all on function access.read_administrator_member(text,text) from public;
revoke all on function access.change_administrator_segment_scope(text,text,bigint,jsonb) from public;
revoke all on function access.record_administrator_member_note(text,text,bigint,text,text,text,text) from public;
grant execute on function access.resolve_administrator_context(text),access.administrator_member_visible(text,text),
  access.list_administrator_members(text,text,integer),access.read_administrator_member(text,text),
  access.change_administrator_segment_scope(text,text,bigint,jsonb),
  access.record_administrator_member_note(text,text,bigint,text,text,text,text)
  to shopapp,shopconsole,zhudatuanidentityapi;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('access.administrators.members.read','access','GET','/api/v1/access/administrator-members','1.0.0'),
  ('access.administrators.member.read','access','GET','/api/v1/access/administrator-members/{nodeid}','1.0.0'),
  ('access.administrators.scopes.manage','access','PUT','/api/v1/access/administrators/{membershipid}/segment-scope','1.0.0'),
  ('access.administrators.members.note','access','POST','/api/v1/access/administrator-members/{nodeid}/notes','1.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;

insert into capability.capability(id,kind,name,version,status)
select operation.id,'operation',operation.id,1,'active' from runtime.operation operation
where operation.id in('access.administrators.members.read','access.administrators.member.read',
  'access.administrators.scopes.manage','access.administrators.members.note')
on conflict(id) do update set kind='operation',name=excluded.name,status='active';

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('access.administrators.members.read','access.administrators.members.read','member.read','operator'),
  ('access.administrators.member.read','access.administrators.member.read','member.read','operator'),
  ('access.administrators.scopes.manage','access.administrators.scopes.manage','access.scope.manage','operator'),
  ('access.administrators.members.note','access.administrators.members.note','member.manage','operator')
on conflict(operation_id) do update set capability_id=excluded.capability_id,
  permission_code=excluded.permission_code,audience=excluded.audience;

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version) values
  ('platform:access.administrators.members.read','organization-platform-root','access.administrators.members.read','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:access.administrators.member.read','organization-platform-root','access.administrators.member.read','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:access.administrators.scopes.manage','organization-platform-root','access.administrators.scopes.manage','enabled',null,'1970-01-01T00:00:00Z',null,0),
  ('platform:access.administrators.members.note','organization-platform-root','access.administrators.members.note','enabled',null,'1970-01-01T00:00:00Z',null,0)
on conflict(id) do update set capability_id=excluded.capability_id,state='enabled',quota=null,
  effective_at=excluded.effective_at,expires_at=null;

insert into runtime.schemaversion(version,checksum)
values('20260912150000','817a06476de98f3e81a24dd386874c7345867df0ad16392241c020b04034fad9');

do $assert$
begin
  if to_regclass('access.administratoridentity') is null
    or to_regclass('access.administratorsegmentscope') is null
    or to_regprocedure('access.resolve_administrator_context(text)') is null
    or to_regprocedure('access.administrator_member_visible(text,text)') is null
    or to_regprocedure('access.change_administrator_segment_scope(text,text,bigint,jsonb)') is null
    or has_function_privilege('public','access.resolve_administrator_context(text)','execute')
    or not has_function_privilege('shopapp','access.resolve_administrator_context(text)','execute')
    or not exists(select 1 from runtime.schemaversion where version='20260912150000'
      and checksum='817a06476de98f3e81a24dd386874c7345867df0ad16392241c020b04034fad9') then
    raise exception 'SFL_ADMIN_SEGMENT_SCOPE_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
