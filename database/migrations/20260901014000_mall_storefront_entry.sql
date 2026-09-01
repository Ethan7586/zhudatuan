begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260901013000') then
    raise exception 'MALL_STOREFRONT_ENTRY_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260901014000') then
    raise exception 'MALL_STOREFRONT_ENTRY_ALREADY_APPLIED';
  end if;
  if exists(select 1 from identity.preauth where purpose='federationselection' and state='active' and consumed_at is null and expires_at>clock_timestamp()) then
    raise exception 'MALL_STOREFRONT_ACTIVE_SELECTION_REQUIRES_DRAIN';
  end if;
  if exists(select lower(public_slug) from experience.application group by lower(public_slug) having count(*)>1) then
    raise exception 'MALL_STOREFRONT_SLUG_CONFLICT';
  end if;
  if exists(select 1 from experience.application where public_slug!~'^[a-z0-9][a-z0-9-]{2,47}$') then
    raise exception 'MALL_STOREFRONT_SLUG_INVALID';
  end if;
  if exists(select 1 from experience.application where public_slug in('admin','api','assets','auth','console','health','login','s','www')) then
    raise exception 'MALL_STOREFRONT_SLUG_RESERVED';
  end if;
  if exists(select application_id from experience.binding group by application_id having count(distinct mall_id)<>1 or count(distinct pool_id)<>1) then
    raise exception 'MALL_STOREFRONT_BINDING_AMBIGUOUS';
  end if;
  if exists(select 1 from experience.application application left join experience.binding binding on binding.application_id=application.id where binding.application_id is null) then
    raise exception 'MALL_STOREFRONT_BINDING_MISSING';
  end if;
  if exists(select 1 from experience.application application join experience.binding binding on binding.application_id=application.id where application.scope_id<>binding.mall_id) then
    raise exception 'MALL_STOREFRONT_SCOPE_MISMATCH';
  end if;
  if exists(select binding.mall_id from experience.binding binding group by binding.mall_id having count(distinct binding.application_id)>1) then
    raise exception 'MALL_STOREFRONT_APPLICATION_DUPLICATE';
  end if;
  if exists(select 1 from experience.binding binding left join organization.organization mall on mall.id=binding.mall_id and mall.kind='mall' left join catalog.pool pool on pool.id=binding.pool_id where mall.id is null or pool.id is null) then
    raise exception 'MALL_STOREFRONT_OWNER_MISSING';
  end if;
  if exists(select application_id from experience.release where state='active' group by application_id having count(*)>1) then
    raise exception 'MALL_STOREFRONT_ACTIVE_RELEASE_DUPLICATE';
  end if;
  if exists(select 1 from experience.release release left join experience.binding binding on binding.application_id=release.application_id
    left join experience.publication publication on publication.release_id=release.id and publication.state='active'
    where release.state='active' and (binding.pool_id is null or publication.id is null)) then
    raise exception 'MALL_STOREFRONT_ACTIVE_RELEASE_INCOMPLETE';
  end if;
  if exists(select 1 from experience.publication publication join experience.release release on release.id=publication.release_id join experience.version version on version.id=publication.version_id where publication.application_id<>release.application_id or publication.version_id<>release.version_id or version.application_id<>publication.application_id or publication.content_hash<>version.configuration_hash or publication.object_hash<>publication.content_hash) then
    raise exception 'MALL_STOREFRONT_PUBLICATION_INTEGRITY_INVALID';
  end if;
end
$precondition$;

alter table experience.application add column mall_id text;
alter table experience.release add column pool_id text;
alter table identity.preauth add column return_target text;
alter table identity.preauth add constraint preauth_return_target_shape_valid check(
  (purpose='federationselection' and ((return_target is not null and length(return_target) between 1 and 4096) or (return_target is null and state<>'active')))
  or (purpose<>'federationselection' and return_target is null)
);

update experience.application application set mall_id=source.mall_id
from(select application_id,min(mall_id) mall_id from experience.binding group by application_id) source
where source.application_id=application.id;

update experience.release release set pool_id=source.pool_id
from(select application_id,min(pool_id) pool_id from experience.binding group by application_id) source
where source.application_id=release.application_id;

alter table experience.application alter column mall_id set not null;
alter table experience.release alter column pool_id set not null;
alter table experience.application add constraint experience_application_mall_fk foreign key(mall_id) references organization.organization(id);
alter table experience.release add constraint experience_release_pool_fk foreign key(pool_id) references catalog.pool(id);

drop index if exists experience.experience_application_scope_time;
alter table experience.application drop constraint if exists application_scope_id_name_key;
alter table experience.application drop constraint if exists experience_application_scope_code_unique;
alter table experience.application drop constraint if exists experience_application_scope_slug_unique;
create unique index application_public_slug_unique on experience.application(lower(public_slug));
create unique index application_mall_unique on experience.application(mall_id);
create index application_scope_page on experience.application(mall_id,updated_at desc,id desc);
drop index if exists experience.experience_release_active;
create unique index release_active_unique on experience.release(application_id) where state='active';
alter index experience.experience_publication_active rename to publication_active_unique;

create function experience.prevent_storefront_handle_change()
returns trigger language plpgsql set search_path=experience,pg_temp as $function$
begin
  if new.public_slug<>old.public_slug then raise exception 'STOREFRONT_HANDLE_IMMUTABLE'; end if;
  return new;
end
$function$;
create trigger application_storefront_handle_immutable before update of public_slug on experience.application
for each row execute function experience.prevent_storefront_handle_change();

drop function experience.resolve_storefront_host(text);
create function experience.resolve_storefront_entry(p_handle text)
returns table(
  application text,handle text,mall text,pool text,release text,version text,tenant text,
  application_status text,validation_state text,publication_state text,content_hash text,configuration_hash text,object_key text
)
language sql stable security definer
set search_path=experience,organization,pg_temp
set row_security=off
as $function$
  select application.id,application.public_slug,application.mall_id,release.pool_id,release.id,version.id,tenant.id,
    application.status,version.validation_state,publication.state,publication.content_hash,version.configuration_hash,publication.object_key
  from experience.application application
  join lateral(select ancestor.id from organization.unitclosure closure
    join organization.organization ancestor on ancestor.id=closure.ancestor_id and ancestor.kind='tenant'
    where closure.descendant_id=application.mall_id order by closure.depth limit 1) tenant on true
  left join lateral(select item.id,item.version_id,item.pool_id from experience.release item
    where item.application_id=application.id and item.state='active' and item.effective_at<=clock_timestamp()
    order by item.effective_at desc,item.id desc limit 1) release on true
  left join experience.version version on version.id=release.version_id
  left join experience.publication publication on publication.release_id=release.id
  where lower(application.public_slug)=p_handle
$function$;
revoke all on function experience.resolve_storefront_entry(text) from public,anon,authenticated,service_role;
grant execute on function experience.resolve_storefront_entry(text) to shopapp,shopjob;

create or replace function experience.read_published(p_mall text)
returns table(release text,version text,hash text,document jsonb,effective_at timestamptz,object_key text)
language sql stable security definer set search_path=experience,pg_temp set row_security=off as $function$
  select release.id,version.id,publication.content_hash,version.configuration,release.effective_at,publication.object_key
  from experience.application application
  join experience.release release on release.application_id=application.id and release.state='active' and release.effective_at<=clock_timestamp()
  join experience.publication publication on publication.release_id=release.id and publication.state='active'
  join experience.version version on version.id=release.version_id and version.validation_state='valid'
    and version.configuration_hash=publication.content_hash and publication.object_hash=publication.content_hash
  where application.mall_id=p_mall
  order by release.effective_at desc,release.id desc limit 1
$function$;

create or replace function access.purchase_application_allowed(p_application text)
returns boolean language sql stable security definer
set search_path=access,experience,pg_temp as $function$
  select p_application is not null and exists(select 1 from experience.application application
    where application.id=p_application and application.status='active' and access.purchase_mall_allowed(application.mall_id))
$function$;

do $resource_scope$
declare definition text; replaced text;
begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into definition;
  replaced:=replace(definition,
    'select scope_id into resolved from experience.application where id=p_resource',
    'select mall_id into resolved from experience.application where id=p_resource');
  replaced:=replace(replaced,
    'select application.scope_id into resolved from experience.version versionrecord',
    'select application.mall_id into resolved from experience.version versionrecord');
  if replaced=definition then raise exception 'MALL_STOREFRONT_RESOURCE_SCOPE_INSERTION_MISSING'; end if;
  execute replaced;
end
$resource_scope$;

drop policy appscope on experience.application;
create policy appscope on experience.application for all to shopapp using(access.scope_allowed(mall_id)) with check(access.scope_allowed(mall_id));
drop policy appscope on experience.publication;
create policy appscope on experience.publication for all to shopapp
  using(exists(select 1 from experience.application where application.id=experience.publication.application_id and access.scope_allowed(application.mall_id)))
  with check(exists(select 1 from experience.application where application.id=experience.publication.application_id and access.scope_allowed(application.mall_id)));

drop policy if exists zhudatuanwebapi on experience.application;
drop policy if exists zhudatuanwebapi on cart.cart;
drop policy if exists zhudatuansandboxbootstrap on experience.application;
drop policy if exists zhudatuansandboxbootstrapinsert on experience.application;
drop policy if exists zhudatuansandboxbootstrapinsert on experience.release;

drop table experience.binding;
alter table experience.application drop column scope_id;

insert into runtime.operation(id,owner,method,path,contract_version)
values('experience.applications.detail.read','experience','GET','/api/v1/experiences/applications/{applicationid}','3.0.0');
insert into capability.capability(id,kind,name,version,status)
values('experience.applications.detail.read','operation','experience.applications.detail.read',3,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('experience.applications.detail.read','experience.applications.detail.read','experience.application.read','console');

alter table runtime.mvpauthority disable row level security;
update runtime.mvpauthority
set checksum=encode(public.digest('packages/contract/definitions/operations.yml:271','sha256'),'hex'),
  expected_count=271,observed_count=271,published_at=clock_timestamp()
where id='mvp:operations';

update runtime.contractcatalog
set checksum='0fa65a88e13853d6db30740982d97f58ed37970de3f9c5d5f3e502ab87da38d7',
  operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event),
  published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

insert into runtime.event(type,version,owner,schema_ref)
values('refund.completed',1,'payment','contract://events/refund.completed/v1')
on conflict(type,version) do update set owner=excluded.owner,schema_ref=excluded.schema_ref;
update runtime.outbox set event_type='refund.completed' where event_type='payment.refunded' and event_version=1;
update runtime.inbox set event_type='refund.completed' where event_type='payment.refunded' and event_version=1;
delete from runtime.event where type='payment.refunded' and version=1;

select runtime.record_migration_evidence('20260901014000',
  (select count(*) from experience.application),(select count(*) from experience.application),0,0,
  'select application,handle,mall,pool,release,version,tenant,application_status,validation_state,publication_state,content_hash,configuration_hash,object_key from experience.resolve_storefront_entry(''zhudatuan-local'');',
  'select lower(public_slug),count(*) from experience.application group by lower(public_slug) having count(*)>1;');
insert into runtime.schemaversion(version,checksum)
values('20260901014000',encode(public.digest('20260901014000_mall_storefront_entry','sha256'),'hex'));

do $assert$
declare definition text;
begin
  if (select count(*) from runtime.operation)<>271 or (select count(*) from capability.operation)<>271 then raise exception 'MALL_STOREFRONT_OPERATION_COUNT_INVALID'; end if;
  if not exists(select 1 from runtime.mvpauthority where id='mvp:operations' and expected_count=271 and observed_count=271) then raise exception 'MALL_STOREFRONT_MVP_AUTHORITY_INVALID'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0' and status='active' and checksum='0fa65a88e13853d6db30740982d97f58ed37970de3f9c5d5f3e502ab87da38d7' and operation_count=271) then raise exception 'MALL_STOREFRONT_CONTRACT_CATALOG_INVALID'; end if;
  if to_regclass('experience.binding') is not null then raise exception 'MALL_STOREFRONT_BINDING_RETAINED'; end if;
  if to_regprocedure('experience.resolve_storefront_host(text)') is not null then raise exception 'MALL_STOREFRONT_HOST_RESOLVER_RETAINED'; end if;
  if to_regprocedure('experience.resolve_storefront_entry(text)') is null then raise exception 'MALL_STOREFRONT_ENTRY_RESOLVER_MISSING'; end if;
  if has_function_privilege('anon','experience.resolve_storefront_entry(text)','EXECUTE') then raise exception 'MALL_STOREFRONT_ENTRY_PUBLIC_EXECUTE'; end if;
  if exists(select 1 from information_schema.columns where table_schema='experience' and table_name='application' and column_name='scope_id') then raise exception 'MALL_STOREFRONT_SCOPE_RETAINED'; end if;
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into definition;
  if position('experience.application where id=p_resource' in definition)=0 or position('application.mall_id' in definition)=0 then raise exception 'MALL_STOREFRONT_RESOURCE_SCOPE_INVALID'; end if;
  if exists(select 1 from experience.application where mall_id is null) or exists(select 1 from experience.release where pool_id is null) then raise exception 'MALL_STOREFRONT_OWNER_NULL'; end if;
  if exists(select 1 from identity.preauth where purpose='federationselection' and state='active' and return_target is null) then raise exception 'MALL_STOREFRONT_SELECTION_TARGET_MISSING'; end if;
end
$assert$;

alter table runtime.mvpauthority enable row level security;
alter table runtime.mvpauthority force row level security;

commit;
