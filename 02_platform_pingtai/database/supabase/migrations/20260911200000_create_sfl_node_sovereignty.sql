begin;

select pg_advisory_xact_lock(hashtext('sfl:node-sovereignty:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260911010000' and checksum='33504f898d2ba5f955ffd8c87584f57fa18d6d7290c567639049fc4f24f2a350') then
    raise exception 'SFL_NODE_SOVEREIGNTY_PREDECESSOR_INVALID';
  end if;
  if to_regclass('organization.node') is not null or to_regclass('organization.noderelation') is not null then
    raise exception 'SFL_NODE_SOVEREIGNTY_TARGET_EXISTS';
  end if;
end
$precondition$;

create table organization.node(
  id text primary key,
  line_id text not null,
  sovereignty_tier text not null check(sovereignty_tier in('sovereign','hosted')),
  node_profile text not null check(node_profile in('operating_mall','consumer')),
  realm_id text not null unique references identity.realm(id),
  mall_id text,
  status text not null check(status in('provisioning','active','suspended','retired')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(id,line_id),
  unique(id,line_id,sovereignty_tier),
  check(sovereignty_tier<>'sovereign' or node_profile='operating_mall'),
  check(node_profile<>'consumer' or mall_id is null)
);

create table organization.noderelation(
  line_id text not null,
  node_id text not null,
  parent_node_id text,
  original_parent_node_id text,
  signed_level text not null check(signed_level~'^L(-[1-9][0-9]*|[0-9]|10|11)$'),
  host_sovereign_node_id text not null,
  host_sovereignty_tier text not null default 'sovereign' check(host_sovereignty_tier='sovereign'),
  relation_version bigint not null check(relation_version>0),
  effective_at timestamptz not null,
  superseded_at timestamptz,
  primary key(line_id,node_id,relation_version),
  foreign key(node_id,line_id) references organization.node(id,line_id),
  foreign key(parent_node_id,line_id) references organization.node(id,line_id),
  foreign key(original_parent_node_id,line_id) references organization.node(id,line_id),
  foreign key(host_sovereign_node_id,line_id,host_sovereignty_tier)
    references organization.node(id,line_id,sovereignty_tier),
  check((signed_level='L0' and parent_node_id is null and original_parent_node_id is null)
    or (signed_level<>'L0' and parent_node_id is not null and original_parent_node_id is not null)),
  check(superseded_at is null or superseded_at>effective_at)
);

create unique index organization_noderelation_one_current_parent
  on organization.noderelation(line_id,node_id) where superseded_at is null;
create index organization_noderelation_parent_lookup
  on organization.noderelation(line_id,parent_node_id,effective_at,superseded_at);
create index organization_noderelation_host_lookup
  on organization.noderelation(line_id,host_sovereign_node_id,effective_at,superseded_at);

create function organization.validate_noderelation_version()
returns trigger language plpgsql
set search_path=pg_catalog,pg_temp
as $function$
declare
  prior organization.noderelation%rowtype;
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
  return new;
end
$function$;

create trigger noderelation_version_guard
before insert or update on organization.noderelation
for each row execute function organization.validate_noderelation_version();

insert into organization.node(id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at)
select realm.node_id,'line:zhudatuan:commerce:v1','sovereign',realm.node_profile,realm.id,realm.mall_id,
  case realm.status when 'disabled' then 'suspended' else realm.status end,realm.created_at,realm.updated_at
from identity.realm realm where realm.id in('realm:l0','realm:l1');

insert into organization.noderelation(
  line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,relation_version,effective_at)
select 'line:zhudatuan:commerce:v1',realm.node_id,
  case realm.id when 'realm:l0' then null else 'node:zhudatuan:l0' end,
  case realm.id when 'realm:l0' then null else 'node:zhudatuan:l0' end,
  case realm.id when 'realm:l0' then 'L0' else 'L1' end,
  realm.node_id,1,realm.created_at
from identity.realm realm where realm.id in('realm:l0','realm:l1');

insert into runtime.schemaversion(version,checksum)
values('20260911200000','274fbae4f0176717cba91b800040d830952b9326b1a629f2af1f73ad5de4f419');

do $assert$
begin
  if (select count(*) from organization.node where id in('node:zhudatuan:l0','node:hbbtzn:l1'))<>2
    or exists(select 1 from organization.node where sovereignty_tier='sovereign' and node_profile<>'operating_mall')
    or (select count(*) from organization.noderelation where superseded_at is null
      and node_id in('node:zhudatuan:l0','node:hbbtzn:l1'))<>2
    or not exists(select 1 from runtime.schemaversion where version='20260911200000'
      and checksum='274fbae4f0176717cba91b800040d830952b9326b1a629f2af1f73ad5de4f419') then
    raise exception 'SFL_NODE_SOVEREIGNTY_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
