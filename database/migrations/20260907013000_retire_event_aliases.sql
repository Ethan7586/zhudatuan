begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260907012000') then raise exception 'EVENT_ALIAS_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260907013000') then raise exception 'EVENT_ALIAS_ALREADY_APPLIED'; end if;
  if not exists(select 1 from runtime.event where type='inventory.reservation.created' and version=1 and retired_at is null)
    or not exists(select 1 from runtime.event where type='experience.release.requested' and version=1 and retired_at is null)
    then raise exception 'EVENT_ALIAS_CANONICAL_TARGET_MISSING'; end if;
end
$precondition$;

update runtime.outbox set event_type='inventory.reservation.created',payload=jsonb_build_object(
  'owner',coalesce(payload->>'order',aggregate_id),'ownerKind','order','lines',coalesce(payload->'lines','[]'::jsonb))
where event_type='inventory.stock.reserved' and event_version=1;
update runtime.inbox set event_type='inventory.reservation.created',payload=jsonb_build_object(
  'owner',coalesce(payload->>'order',payload->>'owner',event_id),'ownerKind','order','lines',coalesce(payload->'lines','[]'::jsonb))
where event_type='inventory.stock.reserved' and event_version=1;
update runtime.outbox set event_type='experience.release.requested'
where event_type='experience.published' and event_version=1;
update runtime.inbox set event_type='experience.release.requested'
where event_type='experience.published' and event_version=1;

delete from runtime.event where type in('inventory.stock.reserved','experience.published');

update runtime.contractcatalog catalog set checksum=fingerprint.checksum,
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event where retired_at is null),
  status='active',published_at=clock_timestamp()
from (select encode(public.digest(
  coalesce((select string_agg(id||chr(31)||owner||chr(31)||method||chr(31)||path||chr(31)||contract_version,chr(30) order by id) from runtime.operation),'')
  ||chr(29)||coalesce((select string_agg(type||chr(31)||version::text||chr(31)||owner||chr(31)||schema_ref,chr(30) order by type,version)
    from runtime.event where retired_at is null),''),'sha256'),'hex') checksum) fingerprint
where catalog.artifact='commerce' and catalog.version='5.0.0';

select runtime.record_migration_evidence('20260907013000',
  (select count(*) from runtime.event where type in('inventory.reservation.created','experience.release.requested') and retired_at is null),
  (select count(*) from runtime.event where type in('inventory.reservation.created','experience.release.requested') and retired_at is null),0,0,
  'select event_type,event_version,count(*) from runtime.outbox where event_type in(''inventory.reservation.created'',''experience.release.requested'') group by event_type,event_version;',
  'select type,version,retired_at from runtime.event where type in(''inventory.stock.reserved'',''experience.published'',''inventory.reservation.created'',''experience.release.requested'') order by type,version;');

insert into runtime.schemaversion(version,checksum)
values('20260907013000',encode(public.digest('20260907013000_retire_event_aliases','sha256'),'hex'));
update runtime.schemahead set migration_head='20260907013000',migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:runtime',published_at=clock_timestamp() where artifact='commerce';

do $assert$
begin
  if exists(select 1 from runtime.event where type in('inventory.stock.reserved','experience.published'))
    or exists(select 1 from runtime.outbox where event_type in('inventory.stock.reserved','experience.published'))
    or exists(select 1 from runtime.inbox where event_type in('inventory.stock.reserved','experience.published'))
    then raise exception 'EVENT_ALIAS_REMAINS'; end if;
  if exists(select 1 from runtime.event event where event.retired_at is not null and not exists(
    select 1 from runtime.event active where active.type=event.type and active.version>event.version and active.retired_at is null))
    then raise exception 'EVENT_RETIREMENT_WITHOUT_SUCCESSOR'; end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce' and migration_head='20260907013000'
    and migration_count=(select count(*) from runtime.schemaversion)) then raise exception 'EVENT_ALIAS_HEAD_INVALID'; end if;
end
$assert$;

commit;
