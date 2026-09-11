begin;

select pg_advisory_xact_lock(hashtext('sfl:storefront-member-hosted-node:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260912010000' and checksum='ad04df36d3de44bec0b507e5af342395e1833bf04862be74679545c1cb0be26a')
    or exists(select 1 from runtime.schemaversion where version>'20260912010000') then
    raise exception 'STOREFRONT_MEMBER_NODE_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

alter table access.membership add column node_id text references organization.node(id);
create unique index access_membership_hosted_node_unique
  on access.membership(node_id) where node_id is not null;

create table organization.storefrontmembernodechange(
  id bigserial primary key,
  node_id text not null references organization.node(id),
  prior_parent_node_id text not null references organization.node(id),
  parent_node_id text not null references organization.node(id),
  prior_signed_level text not null,
  signed_level text not null,
  relation_version bigint not null,
  source text not null,
  requested_by text not null,
  trace_id text not null,
  effective_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  unique(node_id,relation_version)
);

create function organization.provision_storefront_member_node(
  p_membership_id text,
  p_inviter_membership_id text,
  p_requested_by text,
  p_trace_id text,
  p_idempotency_key text,
  p_effective_at timestamptz
)
returns table(
  node_id text,
  parent_node_id text,
  signed_level text,
  host_sovereign_node_id text,
  relation_version integer,
  replayed boolean
)
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare
  v_membership access.membership%rowtype;
  v_host_node_id text;
  v_host_sovereign_node_id text;
  v_parent_node_id text;
  v_parent_level text;
  v_signed_level text;
  v_node_id text;
  v_realm_id text;
  v_effective_at timestamptz:=coalesce(p_effective_at,clock_timestamp());
  v_effective_at_text text;
  v_result record;
begin
  if p_membership_id is null or p_membership_id='' or p_requested_by is null or p_requested_by=''
    or p_trace_id is null or p_trace_id='' or p_idempotency_key is null or p_idempotency_key='' then
    raise exception 'STOREFRONT_MEMBER_NODE_INPUT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('sfl:storefront-member:'||p_membership_id,0));
  select membership.* into v_membership from access.membership membership
  where membership.id=p_membership_id and membership.client='storefront' for update;
  if not found then raise exception 'STOREFRONT_MEMBERSHIP_NOT_FOUND'; end if;

  if v_membership.node_id is not null then
    return query
    select relation.node_id,relation.parent_node_id,relation.signed_level,
      relation.host_sovereign_node_id,relation.relation_version::integer,true
    from organization.noderelation relation
    where relation.node_id=v_membership.node_id and relation.superseded_at is null;
    return;
  end if;

  select node.id,relation.host_sovereign_node_id
  into v_host_node_id,v_host_sovereign_node_id
  from organization.node node
  join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
    and relation.superseded_at is null
  where node.realm_id=v_membership.realm_id and node.node_profile='operating_mall'
    and node.mall_id=v_membership.organization_id and node.status='active';
  if not found then raise exception 'STOREFRONT_MEMBER_HOST_NODE_NOT_FOUND'; end if;

  select inviter.node_id,relation.signed_level
  into v_parent_node_id,v_parent_level
  from access.membership inviter
  join organization.noderelation relation on relation.node_id=inviter.node_id and relation.superseded_at is null
  where inviter.id=p_inviter_membership_id and inviter.organization_id=v_membership.organization_id
    and inviter.client='storefront' and inviter.status='active'
    and relation.signed_level in('L6','L7','L8','L9','L10');

  if v_parent_node_id is null then
    v_parent_node_id:=v_host_node_id;
    v_signed_level:='L6';
  else
    v_signed_level:='L'||((substring(v_parent_level from 2)::integer)+1)::text;
  end if;

  v_node_id:='node:consumer-'||substr(encode(public.digest(convert_to(p_membership_id,'UTF8'),'sha256'),'hex'),1,32)
    ||':l'||lower(substring(v_signed_level from 2));
  v_realm_id:='realm:consumer-'||substr(encode(public.digest(convert_to(p_membership_id,'UTF8'),'sha256'),'hex'),1,32);
  v_effective_at_text:=to_char(v_effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  insert into identity.realm(
    id,node_id,status,created_at,updated_at,version,node_profile,mall_id,host_node_id,host_node_profile
  ) values(
    v_realm_id,v_node_id,'active',v_effective_at,v_effective_at,0,'consumer',null,
    v_host_sovereign_node_id,'operating_mall'
  );

  select * into v_result from organization.provision_hosted_node(jsonb_build_object(
    'idempotency_key',p_idempotency_key,
    'node_id',v_node_id,
    'parent_node_id',v_parent_node_id,
    'realm_id',v_realm_id,
    'node_profile','consumer',
    'mall_id',null,
    'signed_level',v_signed_level,
    'effective_at',v_effective_at_text,
    'requested_by',p_requested_by,
    'trace_id',p_trace_id
  ));

  update access.membership membership set node_id=v_node_id where membership.id=p_membership_id;
  return query select v_result.node_id,v_result.parent_node_id,v_result.signed_level,
    v_result.host_sovereign_node_id,v_result.relation_version,v_result.replayed;
end
$function$;

create function organization.bind_storefront_member_parent(
  p_scope_id text,
  p_customer_member_id text,
  p_referral_member_id text,
  p_requested_by text,
  p_trace_id text,
  p_effective_at timestamptz
)
returns table(node_id text,parent_node_id text,signed_level text,relation_version integer)
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare
  v_child_node_id text;
  v_parent_node_id text;
  v_parent_level integer;
  v_record record;
  v_prior_parent_node_id text;
  v_prior_signed_level text;
  v_prior_relation_version bigint;
  v_prior_effective_at timestamptz;
  v_change_at timestamptz;
begin
  select child.node_id,parent.node_id,substring(parent_relation.signed_level from 2)::integer
  into v_child_node_id,v_parent_node_id,v_parent_level
  from access.membership child
  join referral.member referral_member on referral_member.scope_id=child.organization_id
    and referral_member.id=p_referral_member_id and referral_member.state='active'
  join access.membership parent on parent.organization_id=child.organization_id
    and parent.member_id=referral_member.member_id and parent.client='storefront' and parent.status='active'
  join organization.noderelation parent_relation on parent_relation.node_id=parent.node_id
    and parent_relation.superseded_at is null
  where child.organization_id=p_scope_id and child.member_id=p_customer_member_id
    and child.client='storefront' and child.status='active'
    and parent_relation.signed_level in('L6','L7','L8','L9','L10');
  if not found then raise exception 'STOREFRONT_MEMBER_PARENT_NOT_FOUND'; end if;

  if exists(with recursive subtree as(
      select relation.node_id,0 depth,v_parent_level+1 target_level
      from organization.noderelation relation
      where relation.node_id=v_child_node_id and relation.superseded_at is null
      union all
      select child.node_id,parent.depth+1,parent.target_level+1
      from subtree parent
      join organization.noderelation child on child.parent_node_id=parent.node_id and child.superseded_at is null
    ) select 1 from subtree where target_level>11) then
    raise exception 'STOREFRONT_MEMBER_NODE_LEVEL_EXCEEDS_L11';
  end if;

  for v_record in with recursive subtree as(
      select relation.node_id,0 depth,v_parent_node_id parent_node_id,v_parent_level+1 target_level
      from organization.noderelation relation
      where relation.node_id=v_child_node_id and relation.superseded_at is null
      union all
      select child.node_id,parent.depth+1,parent.node_id,parent.target_level+1
      from subtree parent
      join organization.noderelation child on child.parent_node_id=parent.node_id and child.superseded_at is null
    ) select * from subtree order by depth,node_id loop
    select relation.parent_node_id,relation.signed_level,relation.relation_version,relation.effective_at
    into v_prior_parent_node_id,v_prior_signed_level,v_prior_relation_version,v_prior_effective_at
    from organization.noderelation relation
    where relation.node_id=v_record.node_id and relation.superseded_at is null for update;

    if v_prior_parent_node_id=v_record.parent_node_id
      and v_prior_signed_level='L'||v_record.target_level::text then
      continue;
    end if;
    v_change_at:=greatest(p_effective_at,v_prior_effective_at+interval '1 microsecond');
    update organization.noderelation relation set superseded_at=v_change_at
    where relation.node_id=v_record.node_id and relation.superseded_at is null;
    insert into organization.noderelation(
      line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
      relation_version,effective_at
    ) select prior.line_id,prior.node_id,v_record.parent_node_id,prior.original_parent_node_id,
      'L'||v_record.target_level::text,prior.host_sovereign_node_id,prior.relation_version+1,v_change_at
      from organization.noderelation prior
      where prior.node_id=v_record.node_id and prior.relation_version=v_prior_relation_version;
    insert into organization.storefrontmembernodechange(
      node_id,prior_parent_node_id,parent_node_id,prior_signed_level,signed_level,relation_version,
      source,requested_by,trace_id,effective_at
    ) values(
      v_record.node_id,v_prior_parent_node_id,v_record.parent_node_id,v_prior_signed_level,
      'L'||v_record.target_level::text,v_prior_relation_version+1,'referral.binding',
      p_requested_by,p_trace_id,v_change_at
    );
  end loop;

  return query select relation.node_id,relation.parent_node_id,relation.signed_level,relation.relation_version::integer
  from organization.noderelation relation where relation.node_id=v_child_node_id and relation.superseded_at is null;
end
$function$;

revoke all on function organization.provision_storefront_member_node(text,text,text,text,text,timestamptz) from public;
revoke all on function organization.bind_storefront_member_parent(text,text,text,text,text,timestamptz) from public;
grant usage on schema organization to zhudatuanidentityapi;
grant execute on function organization.provision_storefront_member_node(text,text,text,text,text,timestamptz)
  to zhudatuanidentityapi;
grant execute on function organization.bind_storefront_member_parent(text,text,text,text,text,timestamptz)
  to shopapp,zhudatuanidentityapi;
grant select on organization.node,organization.noderelation to zhudatuanidentityapi;

do $backfill$
declare
  v_record record;
  v_total integer;
  v_resolved integer;
begin
  create temporary table storefront_member_node_backfill on commit drop as
  with recursive members as(
    select membership.id,membership.member_id,membership.organization_id,membership.realm_id,membership.joined_at,
      inviter_membership.id inviter_membership_id
    from access.membership membership
    left join lateral(
      select candidate.id
      from referral.binding binding
      join referral.member referral_member on referral_member.scope_id=binding.scope_id
        and referral_member.id=binding.referral_member_id and referral_member.state='active'
      join access.membership candidate on candidate.organization_id=membership.organization_id
        and candidate.member_id=referral_member.member_id and candidate.client='storefront' and candidate.status='active'
      where binding.scope_id=membership.organization_id and binding.customer_member_id=membership.member_id
        and (binding.expires_at is null or binding.expires_at>coalesce(membership.joined_at,clock_timestamp()))
      order by binding.bound_at desc,binding.id desc limit 1
    ) inviter_membership on true
    where membership.client='storefront'
  ), lineage as(
    select members.id,members.inviter_membership_id,0 depth,array[members.id] path
    from members where members.inviter_membership_id is null
    union all
    select child.id,child.inviter_membership_id,parent.depth+1,parent.path||child.id
    from lineage parent join members child on child.inviter_membership_id=parent.id
    where not child.id=any(parent.path)
  )
  select members.*,lineage.depth from members join lineage using(id);

  select count(*) into v_total from access.membership where client='storefront';
  select count(*) into v_resolved from storefront_member_node_backfill;
  if v_resolved<>v_total then raise exception 'STOREFRONT_MEMBER_NODE_LINEAGE_UNRESOLVED'; end if;
  if exists(select 1 from storefront_member_node_backfill where depth>5) then
    raise exception 'STOREFRONT_MEMBER_NODE_LEVEL_EXCEEDS_L11';
  end if;

  for v_record in select * from storefront_member_node_backfill order by depth,joined_at nulls first,id loop
    perform organization.provision_storefront_member_node(
      v_record.id,v_record.inviter_membership_id,'migration:storefront-member-node-backfill',
      'migration:20260912120000:'||v_record.id,'storefront-member-node:'||v_record.id,
      coalesce(v_record.joined_at,clock_timestamp())
    );
  end loop;
end
$backfill$;

insert into runtime.schemaversion(version,checksum)
values('20260912120000','8e596a480e8656f75246a440d9bbe706239e246b0326812961e01ea963d3fccb');

do $assert$
begin
  if exists(select 1 from access.membership membership
      left join organization.node node on node.id=membership.node_id and node.node_profile='consumer'
      left join organization.noderelation relation on relation.node_id=node.id and relation.superseded_at is null
      where membership.client='storefront'
        and (node.id is null or relation.signed_level not in('L6','L7','L8','L9','L10','L11')))
    or not has_function_privilege('zhudatuanidentityapi',
      'organization.provision_storefront_member_node(text,text,text,text,text,timestamptz)','execute')
    or not exists(select 1 from runtime.schemaversion where version='20260912120000'
      and checksum='8e596a480e8656f75246a440d9bbe706239e246b0326812961e01ea963d3fccb') then
    raise exception 'STOREFRONT_MEMBER_NODE_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
