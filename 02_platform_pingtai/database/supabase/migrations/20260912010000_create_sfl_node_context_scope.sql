begin;

select pg_advisory_xact_lock(hashtext('sfl:node-context-scope:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260911210000' and checksum='2b4f5c28f492da1e4969b791a9dabcbcb43a27f321a08ad4bbc1af5243bc9a70') then
    raise exception 'SFL_NODE_CONTEXT_SCOPE_PREDECESSOR_INVALID';
  end if;
  if to_regclass('organization.nodeclosure') is not null then
    raise exception 'SFL_NODE_CONTEXT_SCOPE_TARGET_EXISTS';
  end if;
end
$precondition$;

create table organization.nodeclosure(
  closure_id bigint generated always as identity primary key,
  line_id text not null,
  descendant_node_id text not null,
  ancestor_node_id text not null,
  depth integer not null check(depth>=0),
  descendant_relation_version bigint not null check(descendant_relation_version>0),
  effective_at timestamptz not null,
  superseded_at timestamptz,
  foreign key(descendant_node_id,line_id) references organization.node(id,line_id),
  foreign key(ancestor_node_id,line_id) references organization.node(id,line_id),
  check((depth=0)=(descendant_node_id=ancestor_node_id)),
  check(superseded_at is null or superseded_at>effective_at)
);

create unique index organization_nodeclosure_one_current_path
  on organization.nodeclosure(line_id,descendant_node_id,ancestor_node_id) where superseded_at is null;
create index organization_nodeclosure_current_ancestors
  on organization.nodeclosure(line_id,descendant_node_id,depth,ancestor_node_id) where superseded_at is null;
create index organization_nodeclosure_current_descendants
  on organization.nodeclosure(line_id,ancestor_node_id,depth,descendant_node_id) where superseded_at is null;

with recursive paths as(
  select relation.line_id,relation.node_id descendant_node_id,relation.node_id ancestor_node_id,0 depth,
    relation.relation_version,relation.effective_at
  from organization.noderelation relation where relation.superseded_at is null
  union all
  select paths.line_id,paths.descendant_node_id,parent.parent_node_id,paths.depth+1,
    paths.relation_version,paths.effective_at
  from paths
  join organization.noderelation parent on parent.line_id=paths.line_id and parent.node_id=paths.ancestor_node_id
    and parent.superseded_at is null
  where parent.parent_node_id is not null
)
insert into organization.nodeclosure(
  line_id,descendant_node_id,ancestor_node_id,depth,descendant_relation_version,effective_at
)
select line_id,descendant_node_id,ancestor_node_id,depth,relation_version,effective_at from paths;

create function organization.refresh_node_closure()
returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$
declare
  affected_nodes text[];
begin
  with recursive descendants(node_id) as(
    select new.node_id
    union all
    select child.node_id
    from descendants
    join organization.noderelation child on child.line_id=new.line_id
      and child.parent_node_id=descendants.node_id and child.superseded_at is null
  )
  select array_agg(node_id) into affected_nodes from descendants;

  update organization.nodeclosure closure
  set superseded_at=new.effective_at
  where closure.line_id=new.line_id and closure.descendant_node_id=any(affected_nodes)
    and closure.superseded_at is null;

  with recursive paths(descendant_node_id,ancestor_node_id,depth) as(
    select affected.node_id,affected.node_id,0
    from unnest(affected_nodes) affected(node_id)
    union all
    select paths.descendant_node_id,parent.parent_node_id,paths.depth+1
    from paths
    join organization.noderelation parent on parent.line_id=new.line_id and parent.node_id=paths.ancestor_node_id
      and parent.superseded_at is null
    where parent.parent_node_id is not null
  )
  insert into organization.nodeclosure(
    line_id,descendant_node_id,ancestor_node_id,depth,descendant_relation_version,effective_at
  )
  select new.line_id,paths.descendant_node_id,paths.ancestor_node_id,paths.depth,
    current_relation.relation_version,new.effective_at
  from paths
  join organization.noderelation current_relation on current_relation.line_id=new.line_id
    and current_relation.node_id=paths.descendant_node_id and current_relation.superseded_at is null;
  return new;
end
$function$;

create trigger noderelation_closure_refresh
after insert on organization.noderelation
for each row execute function organization.refresh_node_closure();

create function organization.resolve_node_context(p_node_id text)
returns table(
  line_id text,node_id text,parent_node_id text,signed_level text,sovereignty_tier text,node_profile text,
  realm_id text,mall_id text,host_sovereign_node_id text,relation_version integer,effective_at text,status text
)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select node.line_id,node.id,relation.parent_node_id,relation.signed_level,node.sovereignty_tier,node.node_profile,
    node.realm_id,node.mall_id,relation.host_sovereign_node_id,relation.relation_version::integer,
    to_char(relation.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),node.status
  from organization.node node
  join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
    and relation.superseded_at is null
  where node.id=p_node_id
$function$;

create function organization.resolve_node_scope_self(p_line_id text,p_node_id text)
returns table(line_id text,node_id text,distance integer,relation_version integer,effective_at text,status text)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select closure.line_id,node.id,closure.depth,current_relation.relation_version::integer,
    to_char(current_relation.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),node.status
  from organization.nodeclosure closure
  join organization.node node on node.id=closure.ancestor_node_id and node.line_id=closure.line_id
  join organization.noderelation current_relation on current_relation.node_id=node.id
    and current_relation.line_id=node.line_id and current_relation.superseded_at is null
  where closure.line_id=p_line_id and closure.descendant_node_id=p_node_id
    and closure.depth=0 and closure.superseded_at is null
$function$;

create function organization.resolve_node_scope_ancestors(p_line_id text,p_node_id text)
returns table(line_id text,node_id text,distance integer,relation_version integer,effective_at text,status text)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select closure.line_id,node.id,closure.depth,current_relation.relation_version::integer,
    to_char(current_relation.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),node.status
  from organization.nodeclosure closure
  join organization.node node on node.id=closure.ancestor_node_id and node.line_id=closure.line_id
  join organization.noderelation current_relation on current_relation.node_id=node.id
    and current_relation.line_id=node.line_id and current_relation.superseded_at is null
  where closure.line_id=p_line_id and closure.descendant_node_id=p_node_id
    and closure.depth>0 and closure.superseded_at is null
  order by closure.depth
$function$;

create function organization.resolve_node_scope_descendants(p_line_id text,p_node_id text)
returns table(line_id text,node_id text,distance integer,relation_version integer,effective_at text,status text)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select closure.line_id,node.id,closure.depth,current_relation.relation_version::integer,
    to_char(current_relation.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),node.status
  from organization.nodeclosure closure
  join organization.node node on node.id=closure.descendant_node_id and node.line_id=closure.line_id
  join organization.noderelation current_relation on current_relation.node_id=node.id
    and current_relation.line_id=node.line_id and current_relation.superseded_at is null
  where closure.line_id=p_line_id and closure.ancestor_node_id=p_node_id
    and closure.depth>0 and closure.superseded_at is null
  order by closure.depth,node.id
$function$;

create function organization.resolve_node_scope_subtree(p_line_id text,p_node_id text)
returns table(line_id text,node_id text,distance integer,relation_version integer,effective_at text,status text)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  select closure.line_id,node.id,closure.depth,current_relation.relation_version::integer,
    to_char(current_relation.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),node.status
  from organization.nodeclosure closure
  join organization.node node on node.id=closure.descendant_node_id and node.line_id=closure.line_id
  join organization.noderelation current_relation on current_relation.node_id=node.id
    and current_relation.line_id=node.line_id and current_relation.superseded_at is null
  where closure.line_id=p_line_id and closure.ancestor_node_id=p_node_id and closure.superseded_at is null
  order by closure.depth,node.id
$function$;

revoke all on organization.nodeclosure from public;
revoke all on function organization.refresh_node_closure() from public;
revoke all on function organization.resolve_node_context(text) from public;
revoke all on function organization.resolve_node_scope_self(text,text) from public;
revoke all on function organization.resolve_node_scope_ancestors(text,text) from public;
revoke all on function organization.resolve_node_scope_descendants(text,text) from public;
revoke all on function organization.resolve_node_scope_subtree(text,text) from public;
grant execute on function organization.resolve_node_context(text) to zhudatuanprovisioningapi;
grant execute on function organization.resolve_node_scope_self(text,text) to zhudatuanprovisioningapi;
grant execute on function organization.resolve_node_scope_ancestors(text,text) to zhudatuanprovisioningapi;
grant execute on function organization.resolve_node_scope_descendants(text,text) to zhudatuanprovisioningapi;
grant execute on function organization.resolve_node_scope_subtree(text,text) to zhudatuanprovisioningapi;

insert into runtime.schemaversion(version,checksum)
values('20260912010000','22eeea98bc478c0b71a099d8e5923c26a4db83862404e041e557aa5d6178d959');

do $assert$
begin
  if to_regclass('organization.nodeclosure') is null
    or to_regprocedure('organization.refresh_node_closure()') is null
    or to_regprocedure('organization.resolve_node_context(text)') is null
    or to_regprocedure('organization.resolve_node_scope_self(text,text)') is null
    or to_regprocedure('organization.resolve_node_scope_ancestors(text,text)') is null
    or to_regprocedure('organization.resolve_node_scope_descendants(text,text)') is null
    or to_regprocedure('organization.resolve_node_scope_subtree(text,text)') is null
    or has_function_privilege('public','organization.resolve_node_context(text)','execute')
    or not has_function_privilege('zhudatuanprovisioningapi','organization.resolve_node_context(text)','execute')
    or not exists(select 1 from runtime.schemaversion where version='20260912010000'
      and checksum='22eeea98bc478c0b71a099d8e5923c26a4db83862404e041e557aa5d6178d959') then
    raise exception 'SFL_NODE_CONTEXT_SCOPE_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
