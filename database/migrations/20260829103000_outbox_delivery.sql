begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829102000') then raise exception 'OUTBOX_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829103000')
    or exists(select 1 from information_schema.columns where table_schema='runtime' and table_name='outbox' and column_name='fencing_token') then
    raise exception 'OUTBOX_ALREADY_APPLIED';
  end if;
end $precondition$;

create temporary table outbox_reconcile on commit drop as select count(*)::bigint rows,0::numeric minor from runtime.outbox;
alter table runtime.outbox add column aggregate_version bigint;
with versions as(select id,row_number() over(partition by aggregate_id order by occurred_at,id) version from runtime.outbox)
update runtime.outbox target set aggregate_version=versions.version from versions where versions.id=target.id;
create function runtime.assign_outbox_aggregate_version() returns trigger language plpgsql set search_path=runtime,pg_temp as $function$
begin
  if new.aggregate_version is null then
    perform pg_advisory_xact_lock(hashtextextended(new.aggregate_id,0));
    select coalesce(max(aggregate_version),0)+1 into new.aggregate_version from runtime.outbox where aggregate_id=new.aggregate_id;
  end if;
  return new;
end $function$;
create trigger runtime_outbox_aggregate_version before insert on runtime.outbox
for each row execute function runtime.assign_outbox_aggregate_version();
alter table runtime.outbox alter column aggregate_version set not null;
alter table runtime.outbox add column fencing_token bigint not null default 0;
alter table runtime.outbox add constraint runtime_outbox_aggregate_version check(aggregate_version>0) not valid;
alter table runtime.outbox add constraint runtime_outbox_fencing_token check(fencing_token>=0) not valid;
alter table runtime.outbox validate constraint runtime_outbox_aggregate_version;
alter table runtime.outbox validate constraint runtime_outbox_fencing_token;
alter table runtime.outbox add unique(aggregate_id,aggregate_version,event_type);
create index runtime_outbox_delivery on runtime.outbox(available_at,aggregate_id,aggregate_version,id)
  where published_at is null and failed_at is null;

select runtime.record_migration_evidence('20260829103000',(select rows from outbox_reconcile),(select count(*) from runtime.outbox),0,0,
  'create index concurrently if not exists runtime_outbox_delivery_live on runtime.outbox(available_at,aggregate_id,aggregate_version,id) where published_at is null and failed_at is null;',
  'update runtime.outbox set claimed_by=null,claim_until=null where published_at is null and claim_until<=clock_timestamp();');
insert into runtime.schemaversion(version,checksum)
values('20260829103000',encode(public.digest('20260829103000_outbox_delivery','sha256'),'hex'));

commit;
