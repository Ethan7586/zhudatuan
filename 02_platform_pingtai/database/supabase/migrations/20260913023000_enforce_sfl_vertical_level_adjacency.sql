begin;

select pg_advisory_xact_lock(hashtext('sfl:vertical-level-adjacency:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260911200000' and checksum='274fbae4f0176717cba91b800040d830952b9326b1a629f2af1f73ad5de4f419') then
    raise exception 'SFL_VERTICAL_LEVEL_ADJACENCY_PREDECESSOR_INVALID';
  end if;
  if exists(
    select 1
    from organization.noderelation child
    where child.signed_level~'^L([1-9]|10|11)$'
      and not exists(
        select 1
        from organization.noderelation parent
        where parent.line_id=child.line_id and parent.node_id=child.parent_node_id
          and parent.effective_at<=child.effective_at
          and (parent.superseded_at is null or child.effective_at<parent.superseded_at)
          and parent.signed_level='L'||(substring(child.signed_level from 2)::integer-1)
      )
  ) then
    raise exception 'SFL_VERTICAL_LEVEL_ADJACENCY_EXISTING_DATA_INVALID';
  end if;
end
$precondition$;

create or replace function organization.validate_noderelation_version()
returns trigger language plpgsql
set search_path=pg_catalog,pg_temp
as $function$
declare
  prior organization.noderelation%rowtype;
  parent_level text;
begin
  if tg_op='UPDATE' then
    if old.superseded_at is not null
      or new.line_id<>old.line_id or new.node_id<>old.node_id
      or new.parent_node_id is distinct from old.parent_node_id
      or new.original_parent_node_id is distinct from old.original_parent_node_id
      or new.signed_level<>old.signed_level
      or new.host_sovereign_node_id<>old.host_sovereign_node_id
      or new.host_sovereignty_tier<>old.host_sovereignty_tier
      or new.relation_version<>old.relation_version or new.effective_at<>old.effective_at
      or new.superseded_at is null then
      raise exception 'SFL_NODE_RELATION_HISTORY_IMMUTABLE';
    end if;
    return new;
  end if;

  if new.relation_version=1 then
    if new.original_parent_node_id is distinct from new.parent_node_id
      or exists(select 1 from organization.noderelation relation
        where relation.line_id=new.line_id and relation.node_id=new.node_id) then
      raise exception 'SFL_NODE_RELATION_ORIGIN_INVALID';
    end if;
  else
    select * into prior from organization.noderelation relation
    where relation.line_id=new.line_id and relation.node_id=new.node_id
      and relation.relation_version=new.relation_version-1;
    if not found or prior.superseded_at is distinct from new.effective_at
      or new.original_parent_node_id is distinct from prior.original_parent_node_id then
      raise exception 'SFL_NODE_RELATION_VERSION_INVALID';
    end if;
  end if;

  if new.signed_level~'^L([1-9]|10|11)$' then
    select relation.signed_level into parent_level
    from organization.noderelation relation
    where relation.line_id=new.line_id and relation.node_id=new.parent_node_id
      and relation.effective_at<=new.effective_at
      and (relation.superseded_at is null or new.effective_at<relation.superseded_at)
    order by relation.effective_at desc,relation.relation_version desc
    limit 1;
    if not found then
      if exists(select 1 from organization.node parent
          where parent.id=new.parent_node_id and parent.line_id<>new.line_id) then
        raise exception 'SFL_NODE_RELATION_CROSS_LINE_INVALID';
      end if;
      raise exception 'SFL_NODE_RELATION_PARENT_INACTIVE';
    end if;
    if parent_level<>'L'||(substring(new.signed_level from 2)::integer-1) then
      raise exception 'SFL_NODE_RELATION_LEVEL_ADJACENCY_INVALID';
    end if;
  end if;
  return new;
end
$function$;

insert into runtime.schemaversion(version,checksum)
values('20260913023000','0bb05e940db94c3714a4fec9884f2fd91c781053bc7c20e03934ba78207dcec1');

do $assert$
begin
  if pg_get_functiondef('organization.validate_noderelation_version()'::regprocedure)
      !~'SFL_NODE_RELATION_LEVEL_ADJACENCY_INVALID'
    or exists(
      select 1
      from organization.noderelation child
      where child.signed_level~'^L([1-9]|10|11)$'
        and not exists(
          select 1
          from organization.noderelation parent
          where parent.line_id=child.line_id and parent.node_id=child.parent_node_id
            and parent.effective_at<=child.effective_at
            and (parent.superseded_at is null or child.effective_at<parent.superseded_at)
            and parent.signed_level='L'||(substring(child.signed_level from 2)::integer-1)
        )
    )
    or not exists(select 1 from runtime.schemaversion where version='20260913023000'
      and checksum='0bb05e940db94c3714a4fec9884f2fd91c781053bc7c20e03934ba78207dcec1') then
    raise exception 'SFL_VERTICAL_LEVEL_ADJACENCY_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
