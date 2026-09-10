begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904014000') then raise exception 'CAPABILITY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904015000') then raise exception 'CAPABILITY_ALREADY_APPLIED'; end if;
end
$precondition$;

alter table capability.operation add column targets text[];
update capability.operation set targets=case audience
  when 'console' then array['console']::text[]
  when 'storefront' then array['storefront','miniapp']::text[]
  when 'public' then array['console','storefront','miniapp','store','supplier']::text[]
  else array[]::text[] end;
alter table capability.operation alter column targets set not null;
alter table capability.operation add constraint operation_targets_valid check(
  targets<@array['console','storefront','miniapp','store','supplier']::text[] and cardinality(targets)<=5
) not valid;
alter table capability.operation validate constraint operation_targets_valid;

alter table capability.entitlement add column created_at timestamptz;
alter table capability.entitlement add column updated_at timestamptz;
alter table capability.entitlement add column updated_by text;
alter table capability.entitlement add column reason text;
update capability.entitlement set created_at=effective_at,updated_at=effective_at,updated_by='migration',reason='baseline';
alter table capability.entitlement alter column created_at set default clock_timestamp();
alter table capability.entitlement alter column updated_at set default clock_timestamp();
alter table capability.entitlement alter column updated_by set default 'catalogpublish';
alter table capability.entitlement alter column reason set default 'catalogpublish';
alter table capability.entitlement alter column created_at set not null;
alter table capability.entitlement alter column updated_at set not null;
alter table capability.entitlement alter column updated_by set not null;
alter table capability.entitlement alter column reason set not null;

create table capability.entitlementhistory(
  id text primary key,
  entitlement_id text not null,
  scope_id text not null,
  capability_id text not null references capability.capability(id),
  state text not null check(state in('enabled','disabled')),
  quota bigint check(quota is null or quota>=0),
  effective_at timestamptz not null,
  expires_at timestamptz,
  version bigint not null check(version>=0),
  actor_id text not null,
  reason text not null,
  recorded_at timestamptz not null,
  check(expires_at is null or expires_at>effective_at)
);

insert into capability.entitlementhistory(
  id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at
)
select 'entitlementhistory:'||encode(public.digest(id||':'||scope_id||':'||capability_id||':'||effective_at::text,'sha256'),'hex'),
  id,scope_id,capability_id,state,quota,effective_at,expires_at,version,'migration','baseline',clock_timestamp()
from capability.entitlement;

with ranked as (
  select id,row_number() over(partition by scope_id,capability_id order by effective_at desc,version desc,id desc) position
  from capability.entitlement
)
delete from capability.entitlement entitlement using ranked where entitlement.id=ranked.id and ranked.position>1;

create unique index entitlement_current_scope_capability on capability.entitlement(scope_id,capability_id);
create index entitlement_history_subject on capability.entitlementhistory(scope_id,capability_id,recorded_at desc,id desc);

create table capability.capabilityset(
  scope_id text primary key,
  version bigint not null check(version>=0),
  updated_at timestamptz not null
);
insert into capability.capabilityset(scope_id,version,updated_at)
select scope_id,greatest(coalesce(max(version),0),1),clock_timestamp()
from capability.entitlement group by scope_id;

insert into capability.capability(id,kind,name,version,status) values
  ('surface.auth','feature','登录与认证端',1,'active'),
  ('surface.console','feature','运营管理端',1,'active'),
  ('surface.storefront','feature','消费者商城',1,'active'),
  ('surface.miniapp','feature','消费者小程序',1,'active'),
  ('surface.store','feature','门店工作台',1,'active'),
  ('surface.supplier','feature','供应商工作台',1,'active'),
  ('approval.workflow','feature','审批工作流',1,'active'),
  ('voucher.lifecycle','feature','卡券完整生命周期',1,'active'),
  ('runtime.importing','feature','统一导入内核',1,'active')
on conflict(id) do update set kind=excluded.kind,name=excluded.name,status='active',version=greatest(capability.capability.version,excluded.version);

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
select 'platform:'||capability.id,'organization-platform-root',capability.id,'enabled',null,'1970-01-01T00:00:00Z',null,1,
  clock_timestamp(),clock_timestamp(),'migration','featurepublish'
from capability.capability capability
where capability.id in('surface.auth','surface.console','surface.storefront','surface.miniapp','surface.store','surface.supplier','approval.workflow','voucher.lifecycle','runtime.importing')
on conflict(scope_id,capability_id) do update set state='enabled',expires_at=null,updated_at=clock_timestamp(),updated_by='migration',reason='featurepublish';

insert into capability.entitlementhistory(id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select 'entitlementhistory:'||encode(public.digest(entitlement.id||':featurepublish','sha256'),'hex'),entitlement.id,entitlement.scope_id,
  entitlement.capability_id,entitlement.state,entitlement.quota,entitlement.effective_at,entitlement.expires_at,entitlement.version,
  'migration','featurepublish',clock_timestamp()
from capability.entitlement entitlement
where entitlement.scope_id='organization-platform-root'
  and entitlement.capability_id in('surface.auth','surface.console','surface.storefront','surface.miniapp','surface.store','surface.supplier','approval.workflow','voucher.lifecycle','runtime.importing')
on conflict(id) do nothing;

insert into capability.dependency(capability_id,depends_on_id)
select source.capability_id,source.depends_on_id from (values
  ('approval.workflow','surface.console'),
  ('runtime.importing','surface.console'),
  ('approval.templates.create','approval.workflow'),
  ('approval.templates.revise','approval.workflow'),
  ('approval.templates.enable','approval.workflow'),
  ('approval.templates.disable','approval.workflow'),
  ('approval.templates.get','approval.workflow'),
  ('approval.templates.list','approval.workflow'),
  ('approval.tasks.list','approval.workflow'),
  ('approval.tasks.approve','approval.workflow'),
  ('approval.tasks.reject','approval.workflow'),
  ('approval.instances.get','approval.workflow'),
  ('member.imports.create','runtime.importing'),
  ('member.imports.read','runtime.importing'),
  ('catalog.imports.create','runtime.importing'),
  ('catalog.imports.read','runtime.importing'),
  ('inventory.imports.create','runtime.importing'),
  ('inventory.imports.read','runtime.importing'),
  ('voucher.cardlibraries.read','voucher.lifecycle'),
  ('voucher.cardlibraries.create','voucher.lifecycle'),
  ('voucher.cardlibraries.allocate','voucher.lifecycle'),
  ('voucher.imports.read','voucher.lifecycle'),
  ('voucher.imports.read','runtime.importing'),
  ('voucher.programs.read','voucher.lifecycle'),
  ('voucher.programs.manage','voucher.lifecycle'),
  ('voucher.reserves.read','voucher.lifecycle'),
  ('voucher.reserves.request','voucher.lifecycle'),
  ('voucher.reserves.decide','voucher.lifecycle'),
  ('voucher.batches.read','voucher.lifecycle'),
  ('voucher.batches.issue','voucher.lifecycle'),
  ('voucher.batches.retry','voucher.lifecycle'),
  ('voucher.status.batch','voucher.lifecycle'),
  ('voucher.statusbatches.read','voucher.lifecycle'),
  ('voucher.bindings.read','voucher.lifecycle'),
  ('voucher.bindings.manage','voucher.lifecycle'),
  ('voucher.redemptions.read','voucher.lifecycle'),
  ('voucher.history.read','voucher.lifecycle'),
  ('voucher.redemptions.reverse','voucher.lifecycle')
) source(capability_id,depends_on_id)
join capability.capability capability on capability.id=source.capability_id
join capability.capability required on required.id=source.depends_on_id
on conflict do nothing;

create function capability.guard_dependency_cycle() returns trigger language plpgsql set search_path=capability,pg_temp as $function$
begin
  if exists(
    with recursive reachable(id) as (
      select new.depends_on_id
      union
      select dependency.depends_on_id from capability.dependency dependency join reachable on dependency.capability_id=reachable.id
    ) select 1 from reachable where id=new.capability_id
  ) then raise exception 'CAPABILITY_DEPENDENCY_CYCLE'; end if;
  return new;
end
$function$;
create constraint trigger capability_dependency_cycle after insert or update on capability.dependency
deferrable initially deferred for each row execute function capability.guard_dependency_cycle();

create function capability.effective_entitlements(p_scope_ids text[])
returns table(
  scope_id text,capability_id text,state text,quota bigint,source_scope_id text,source_entitlement_id text,
  source_version bigint,effective_at timestamptz,expires_at timestamptz,disabled_reason text,
  dependencies_healthy boolean,capability_version bigint
)
language sql stable security definer
set search_path=capability,organization,pg_temp as $function$
  with recursive requested as (
    select distinct value scope_id from unnest(p_scope_ids) value where value is not null
  ), lineage as (
    select requested.scope_id,requested.scope_id ancestor_id,0 depth from requested
    union all
    select requested.scope_id,closure.ancestor_id,closure.depth
    from requested join organization.unitclosure closure on closure.descendant_id=requested.scope_id and closure.depth>0
  ), active as materialized (
    select lineage.scope_id,lineage.ancestor_id,lineage.depth,entitlement.id,entitlement.capability_id,
      entitlement.state,entitlement.quota,entitlement.effective_at,entitlement.expires_at,entitlement.version
    from lineage join capability.entitlement entitlement on entitlement.scope_id=lineage.ancestor_id
    where entitlement.effective_at<=clock_timestamp() and (entitlement.expires_at is null or entitlement.expires_at>clock_timestamp())
  ), dependencytree(root,required) as (
    select capability_id,depends_on_id from capability.dependency
    union
    select dependencytree.root,dependency.depends_on_id
    from dependencytree join capability.dependency dependency on dependency.capability_id=dependencytree.required
  ), versions as (
    select requested.scope_id,
      coalesce((select sum(capabilityset.version) from lineage join capability.capabilityset capabilityset on capabilityset.scope_id=lineage.ancestor_id where lineage.scope_id=requested.scope_id),0)
      +coalesce((select sum(catalog.version) from capability.capability catalog),0) value
    from requested
  ), base as materialized (
    select requested.scope_id,catalog.id capability_id,
      case
        when catalog.status<>'active' then 'disabled'
        when exists(select 1 from active where active.scope_id=requested.scope_id and active.capability_id=catalog.id and active.state='disabled') then 'disabled'
        when exists(select 1 from active where active.scope_id=requested.scope_id and active.capability_id=catalog.id and active.state='enabled') then 'enabled'
        else 'disabled'
      end state,
      (select min(active.quota) from active where active.scope_id=requested.scope_id and active.capability_id=catalog.id and active.state='enabled') quota,
      source.ancestor_id source_scope_id,source.id source_entitlement_id,source.version source_version,
      source.effective_at,source.expires_at,
      case
        when catalog.status<>'active' then 'retired'
        when source.state='disabled' then 'explicitdisabled'
        when source.depth=0 and source.state='enabled' and exists(select 1 from active parentdeny where parentdeny.scope_id=requested.scope_id and parentdeny.capability_id=catalog.id and parentdeny.depth>0 and parentdeny.state='disabled') then 'parentnotgranted'
        when source.depth=0 and source.state='enabled' and exists(select 1 from lineage parentline where parentline.scope_id=requested.scope_id and parentline.depth>0)
          and not exists(select 1 from active parentgrant where parentgrant.scope_id=requested.scope_id and parentgrant.capability_id=catalog.id and parentgrant.depth>0 and parentgrant.state='enabled') then 'parentnotgranted'
        when source.id is null and exists(select 1 from lineage join capability.entitlement expired on expired.scope_id=lineage.ancestor_id
          where lineage.scope_id=requested.scope_id and expired.capability_id=catalog.id and expired.expires_at<=clock_timestamp()) then 'expired'
        when source.id is null then 'notgranted'
        else null
      end disabled_reason
    from requested cross join capability.capability catalog
    left join lateral (
      select active.* from active where active.scope_id=requested.scope_id and active.capability_id=catalog.id
      order by active.depth,active.effective_at desc,active.id desc limit 1
    ) source on true
  ), resolved as (
    select base.*,
      not exists(
        select 1 from dependencytree
        left join base required on required.scope_id=base.scope_id and required.capability_id=dependencytree.required
        where dependencytree.root=base.capability_id and coalesce(required.state,'disabled')<>'enabled'
      ) dependencies_healthy
    from base
  )
  select resolved.scope_id,resolved.capability_id,
    case when resolved.state='enabled' and resolved.dependencies_healthy then 'enabled' else 'disabled' end,
    resolved.quota,resolved.source_scope_id,resolved.source_entitlement_id,resolved.source_version,
    resolved.effective_at,resolved.expires_at,
    case when resolved.state='enabled' and not resolved.dependencies_healthy then 'dependencyunhealthy' else resolved.disabled_reason end,
    resolved.dependencies_healthy,versions.value
  from resolved join versions on versions.scope_id=resolved.scope_id
  order by resolved.scope_id,resolved.capability_id
$function$;

create or replace function capability.navigation_capabilities(p_scope_ids text[],p_target text)
returns table(scope_id text,capability_code text,capability_version bigint)
language sql stable security definer set search_path=capability,pg_temp as $function$
  with effective as materialized(select * from capability.effective_entitlements(p_scope_ids)),
  surface as materialized(
    select effective.scope_id,effective.state from effective where effective.capability_id='surface.'||p_target
  )
  select effective.scope_id,catalog.name,effective.capability_version
  from effective join capability.capability catalog on catalog.id=effective.capability_id
  left join capability.operation operation on operation.capability_id=catalog.id
  join surface on surface.scope_id=effective.scope_id and surface.state='enabled'
  where effective.state='enabled' and effective.dependencies_healthy
    and (catalog.kind<>'operation' or p_target=any(operation.targets))
  order by effective.scope_id,catalog.name
$function$;

create or replace function capability.membership_operations(p_membership_id text)
returns table(operation_id text) language sql stable security definer
set search_path=capability,access,pg_temp as $function$
  with subject as (
    select membership.organization_id,case membership.client when 'operator' then 'console' else membership.client end target
    from access.membership membership where membership.id=p_membership_id and membership.status='active'
  ), permissions as materialized (
    select permission_code,effect from access.effective_permissions(p_membership_id)
  ), effective as materialized (
    select entitlement.* from subject cross join lateral capability.effective_entitlements(array[subject.organization_id]) entitlement
  )
  select operation.operation_id from subject
  join effective surface on surface.scope_id=subject.organization_id and surface.capability_id='surface.'||subject.target and surface.state='enabled'
  join capability.operation operation on subject.target=any(operation.targets)
  join effective enabled on enabled.scope_id=subject.organization_id and enabled.capability_id=operation.capability_id
    and enabled.state='enabled' and enabled.dependencies_healthy
  where operation.permission_code is null or exists(
    select 1 from permissions permission where permission.permission_code=operation.permission_code and permission.effect='allow'
  )
  order by operation.operation_id
$function$;

create or replace function capability.membership_authorization(p_membership_id text)
returns table(operation_ids text[],capability_version bigint)
language sql stable security definer set search_path=capability,access,pg_temp as $function$
  with subject as (
    select membership.organization_id from access.membership membership
    where membership.id=p_membership_id and membership.status='active'
  ), effective as materialized (
    select entitlement.* from subject cross join lateral capability.effective_entitlements(array[subject.organization_id]) entitlement
  ), available as materialized(
    select operation_id from capability.membership_operations(p_membership_id)
  )
  select coalesce(array_agg(available.operation_id order by available.operation_id),'{}'::text[]),
    coalesce(max(effective.capability_version),0)::bigint
  from effective left join available on true
$function$;

drop function capability.navigation_capabilities(text[]);

alter table capability.entitlementhistory enable row level security;
alter table capability.entitlementhistory force row level security;
alter table capability.capabilityset enable row level security;
alter table capability.capabilityset force row level security;
create policy migrationaccess on capability.entitlementhistory for all to shopmigration using(true) with check(true);
create policy migrationaccess on capability.capabilityset for all to shopmigration using(true) with check(true);
create policy entitlementhistoryapp on capability.entitlementhistory for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy entitlementhistoryjob on capability.entitlementhistory for all to shopjob using(true) with check(true);
create policy capabilitysetapp on capability.capabilityset for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy capabilitysetjob on capability.capabilityset for all to shopjob using(true) with check(true);

revoke all on function capability.guard_dependency_cycle(),capability.effective_entitlements(text[]),capability.navigation_capabilities(text[],text),
  capability.membership_operations(text),capability.membership_authorization(text) from public;
grant execute on function capability.effective_entitlements(text[]),capability.navigation_capabilities(text[],text),
  capability.membership_operations(text),capability.membership_authorization(text) to shopapp,shopjob;
grant select,insert,update on capability.capabilityset,capability.entitlementhistory to shopapp,shopjob,shopcapabilitywriter;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('pricing.offers.read','pricing','GET','/api/v1/pricing/offers','5.0.0'),
  ('inventory.availability.read','inventory','GET','/api/v1/inventory/availability','5.0.0');

update access.permission set name_zh=case code
  when 'pricing.offer.read' then '查看可售价格'
  when 'inventory.read' then '查看可用库存'
  else name_zh end
where code in('pricing.offer.read','inventory.read');

insert into capability.capability(id,kind,name,version,status) values
  ('pricing.offers.read','operation','pricing.offers.read',1,'active'),
  ('inventory.availability.read','operation','inventory.availability.read',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('pricing.offers.read','pricing.offers.read','pricing.offer.read','public',array['console','storefront','miniapp','store','supplier']),
  ('inventory.availability.read','inventory.availability.read','inventory.read','public',array['console','storefront','miniapp','store','supplier']);

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason) values
  ('platform:pricing.offers.read','organization-platform-root','pricing.offers.read','enabled',null,'1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration','publicreadrestore'),
  ('platform:inventory.availability.read','organization-platform-root','inventory.availability.read','enabled',null,'1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration','publicreadrestore');

insert into capability.entitlementhistory(id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select 'entitlementhistory:'||encode(public.digest(entitlement.id||':publicreadrestore','sha256'),'hex'),entitlement.id,entitlement.scope_id,
  entitlement.capability_id,entitlement.state,entitlement.quota,entitlement.effective_at,entitlement.expires_at,entitlement.version,
  'migration','publicreadrestore',clock_timestamp()
from capability.entitlement entitlement where entitlement.capability_id in('pricing.offers.read','inventory.availability.read');

update capability.capabilityset set version=version+1,updated_at=clock_timestamp() where scope_id='organization-platform-root';

select runtime.record_migration_evidence(
  '20260904015000',
  (select count(*) from capability.capability where id in('surface.auth','surface.console','surface.storefront','surface.miniapp','surface.store','surface.supplier','approval.workflow','voucher.lifecycle','runtime.importing')),
  9,0,0,
  'select * from capability.effective_entitlements(array[''organization-platform-root'']);',
  'select scope_id,version from capability.capabilityset order by scope_id;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904015000',encode(public.digest('20260904015000_prepare_capability','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from capability.capability where id like 'surface.%')<>6 then raise exception 'CAPABILITY_SURFACE_COUNT_INVALID'; end if;
  if exists(select 1 from capability.entitlement group by scope_id,capability_id having count(*)>1) then raise exception 'CAPABILITY_CURRENT_DUPLICATE'; end if;
  if exists(select 1 from capability.operation where targets is null or not(targets<@array['console','storefront','miniapp','store','supplier']::text[])) then raise exception 'CAPABILITY_TARGET_INVALID'; end if;
  if not exists(select 1 from capability.effective_entitlements(array['organization-platform-root']) where capability_id='surface.console' and state='enabled') then raise exception 'CAPABILITY_ROOT_SURFACE_DISABLED'; end if;
  if (select count(*) from capability.operation where operation_id in('pricing.offers.read','inventory.availability.read')
      and targets=array['console','storefront','miniapp','store','supplier']::text[])<>2 then
    raise exception 'CAPABILITY_PUBLIC_READ_RESTORE_INVALID';
  end if;
end
$assert$;

commit;
