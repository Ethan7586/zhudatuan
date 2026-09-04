begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904055000') then raise exception 'IDEAL_REPORTING_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904056000') then raise exception 'IDEAL_REPORTING_ALREADY_APPLIED'; end if;
  if to_regclass('reporting.metric') is null or to_regclass('reporting.watermark') is null
    or to_regclass('reporting.export') is null then raise exception 'IDEAL_REPORTING_TABLES_MISSING'; end if;
end
$precondition$;

create table reporting.snapshot(
  id text primary key check(id~'^reportsnapshot:'),
  tenant_id text not null,
  scope_id text not null,
  report text not null check(report~'^[a-z][a-z0-9.]{1,127}$'),
  metric_versions jsonb not null check(jsonb_typeof(metric_versions)='object'),
  dimensions jsonb not null check(jsonb_typeof(dimensions)='object'),
  watermark_event text not null,
  watermark_at timestamptz not null,
  watermark_version bigint not null check(watermark_version>0),
  row_count bigint not null check(row_count>=0),
  checksum char(64) not null check(checksum~'^[0-9a-f]{64}$'),
  object_reference text,
  created_by text not null,
  created_at timestamptz not null,
  retention_until timestamptz not null check(retention_until>created_at),
  unique(scope_id,report,watermark_event,watermark_version)
);
create index reporting_snapshot_scope on reporting.snapshot(scope_id,report,watermark_at desc,id)
  include(row_count,checksum,object_reference,retention_until);
alter table reporting.snapshot enable row level security;
alter table reporting.snapshot force row level security;
create policy snapshotapp on reporting.snapshot for select to shopapp using(access.scope_allowed(scope_id));
create policy snapshotjob on reporting.snapshot for all to shopjob using(true) with check(true);
revoke all on reporting.snapshot from public;
grant select on reporting.snapshot to shopapp;
grant select,insert,delete on reporting.snapshot to shopjob;
create trigger reporting_snapshot_immutable before update on reporting.snapshot
  for each row execute function reporting.reject_revision_mutation();

select runtime.record_migration_evidence('20260904056000',
  (select count(*) from reporting.metric),(select count(*) from reporting.metric),0,0,
  'select id,version,dimensions,formula from reporting.metric order by id,version;',
  'select projection,scope_id,watermark,version from reporting.watermark order by projection,scope_id;');
insert into runtime.schemaversion(version,checksum)
values('20260904056000',encode(public.digest('20260904056000_prepare_reporting_snapshots','sha256'),'hex'));

commit;
