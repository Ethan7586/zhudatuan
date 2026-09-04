begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904032100') then raise exception 'REPORTING_SNAPSHOT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904032200') then raise exception 'REPORTING_SNAPSHOT_ALREADY_APPLIED'; end if;
end
$precondition$;

alter table reporting.export add column query_snapshot jsonb;
alter table reporting.export add column watermark_event text;
alter table reporting.export add column watermark_at timestamptz;
alter table reporting.export add column watermark_version bigint;
alter table reporting.export add column generation_version integer;

update reporting.export set query_snapshot=filter,watermark_event='reporting:legacy:'||id,
  watermark_at=created_at,watermark_version=1,generation_version=1;

alter table reporting.export alter column query_snapshot set not null;
alter table reporting.export alter column watermark_event set not null;
alter table reporting.export alter column watermark_at set not null;
alter table reporting.export alter column watermark_version set not null;
alter table reporting.export alter column generation_version set not null;
alter table reporting.export add constraint reporting_export_query_snapshot check(
  jsonb_typeof(query_snapshot)='object' and pg_column_size(query_snapshot)<=16384
);
alter table reporting.export add constraint reporting_export_watermark check(
  length(watermark_event) between 1 and 255 and watermark_version>0 and watermark_at<=created_at
);
alter table reporting.export add constraint reporting_export_generation check(generation_version>0);

create function reporting.guard_export_snapshot() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$
begin
  if new.scope_id<>old.scope_id or new.report<>old.report or new.filter<>old.filter or new.query_snapshot<>old.query_snapshot or
    new.authorization_snapshot<>old.authorization_snapshot or new.watermark_event<>old.watermark_event or new.watermark_at<>old.watermark_at or
    new.watermark_version<>old.watermark_version or new.generation_version<>old.generation_version or new.created_at<>old.created_at then
    raise exception 'REPORTING_EXPORT_SNAPSHOT_IMMUTABLE';
  end if;
  return new;
end
$function$;
revoke all on function reporting.guard_export_snapshot() from public,shopapp,shopjob;
create trigger reporting_export_snapshot_immutable before update on reporting.export
for each row execute function reporting.guard_export_snapshot();

alter table reporting.export force row level security;
create index reporting_export_watermark on reporting.export(scope_id,watermark_at desc,id desc);

select runtime.record_migration_evidence(
  '20260904032200',0,0,0,0,
  'select id,scope_id,report,query_snapshot,watermark_event,watermark_at,watermark_version,generation_version from reporting.export order by created_at desc,id desc;',
  'select scope_id,watermark_event,watermark_at,count(*) from reporting.export group by scope_id,watermark_event,watermark_at;'
);

insert into runtime.schemaversion(version,checksum)
values('20260904032200',encode(public.digest('20260904032200_freeze_reporting_snapshot','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from reporting.export where query_snapshot is null or watermark_event is null or watermark_at is null or watermark_version<1 or generation_version<1) then raise exception 'REPORTING_EXPORT_SNAPSHOT_BACKFILL_INVALID'; end if;
  if (select count(*) from pg_trigger where tgrelid='reporting.export'::regclass and tgname='reporting_export_snapshot_immutable' and not tgisinternal)<>1 then raise exception 'REPORTING_EXPORT_SNAPSHOT_GUARD_MISSING'; end if;
end
$assert$;

commit;
