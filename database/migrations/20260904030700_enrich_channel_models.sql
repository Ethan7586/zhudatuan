begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904030600') then raise exception 'CHANNEL_MODEL_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904030700') then raise exception 'CHANNEL_MODEL_ALREADY_APPLIED'; end if;
  if exists(select 1 from channel.connection connection where not exists(
    select 1 from extension.installation installation
    where (installation.id=connection.id or installation.extension_id=connection.provider and installation.scope_id=connection.scope_id)
      and jsonb_typeof(installation.manifest->'capabilities')='array'
      and jsonb_array_length(installation.manifest->'capabilities')>0)) then raise exception 'CHANNEL_CAPABILITY_SNAPSHOT_SOURCE_MISSING'; end if;
end
$precondition$;

create temporary table channel_model_before on commit drop as
select (select count(*) from channel.connection)+(select count(*) from channel.syncrun)+
  (select count(*) from channel.externalobject)+(select count(*) from channel.webhookinbox) rows_count;

alter table channel.connection add column capability_snapshot jsonb;
update channel.connection connection set capability_snapshot=(
  select installation.manifest->'capabilities' from extension.installation installation
  where installation.id=connection.id or installation.extension_id=connection.provider and installation.scope_id=connection.scope_id
  order by (installation.id=connection.id) desc,(installation.status='enabled') desc,installation.version desc limit 1
);
alter table channel.connection alter column capability_snapshot set not null;
alter table channel.connection add constraint channel_connection_capabilities check(
  jsonb_typeof(capability_snapshot)='array' and jsonb_array_length(capability_snapshot)>0 and pg_column_size(capability_snapshot)<=8192);
alter table channel.connection add constraint channel_connection_secretref check(
  secret_ref is null or length(secret_ref) between 3 and 256 and secret_ref~'^[a-z0-9][a-z0-9/.-]+$');

alter table channel.syncrun add column phase text not null default 'pull';
alter table channel.syncrun add column failure_class text;
alter table channel.syncrun add column failure_code text;
alter table channel.syncrun add column failure_retryable boolean;
alter table channel.syncrun add column version bigint not null default 0;
update channel.syncrun set phase=case when state in('completed','failed','cancelled') then 'commit' else 'pull' end,
  failure_class=case when state='failed' then 'unknown' end,
  failure_code=case when state='failed' then 'CHANNEL_SYNC_FAILED' end,
  failure_retryable=case when state='failed' then false end;
alter table channel.syncrun add constraint channel_syncrun_phase check(phase in('pull','apply','commit'));
alter table channel.syncrun add constraint channel_syncrun_version check(version>=0);
alter table channel.syncrun add constraint channel_syncrun_failure check(
  (state='failed' and failure_class in('validation','authentication','authorization','conflict','ratelimit','timeout','unavailable','provider','unknown')
    and failure_code~'^[A-Z][A-Z0-9_]{2,127}$' and failure_retryable is not null)
  or (state<>'failed' and failure_class is null and failure_code is null and failure_retryable is null));

alter table channel.externalobject add column source_watermark timestamptz;
alter table channel.externalobject add column version bigint not null default 0;
update channel.externalobject set source_watermark=mapped_at;
alter table channel.externalobject alter column source_watermark set not null;
alter table channel.externalobject add constraint channel_externalobject_version check(version>=0);

alter table channel.webhookinbox add column watermark timestamptz;
alter table channel.webhookinbox add column failure_class text;
alter table channel.webhookinbox add column failure_retryable boolean;
alter table channel.webhookinbox add column version bigint not null default 0;
update channel.webhookinbox set watermark=received_at,
  failure_class=case when state='failed' then 'unknown' end,
  error_code=case when state='failed' then 'CHANNEL_WEBHOOK_FAILED' else error_code end,
  failure_retryable=case when state='failed' then false end;
alter table channel.webhookinbox alter column watermark set not null;
alter table channel.webhookinbox alter column watermark set default clock_timestamp();
alter table channel.webhookinbox add constraint channel_webhookinbox_version check(version>=0);
alter table channel.webhookinbox add constraint channel_webhookinbox_failure check(
  (state='failed' and failure_class in('validation','authentication','authorization','conflict','ratelimit','timeout','unavailable','provider','unknown')
    and error_code~'^[A-Z][A-Z0-9_]{2,127}$' and failure_retryable is not null)
  or (state<>'failed' and failure_class is null and failure_retryable is null));

create function channel.guard_syncrun_checkpoint() returns trigger language plpgsql set search_path=pg_catalog,channel as $function$
begin
  if new.version<>old.version+1 then raise exception 'CHANNEL_SYNC_VERSION_INVALID'; end if;
  if new.cursor_value is distinct from old.cursor_value and new.phase<>'commit' then raise exception 'CHANNEL_SYNC_CURSOR_UNCOMMITTED'; end if;
  if old.watermark is not null and new.watermark<old.watermark then raise exception 'CHANNEL_SYNC_WATERMARK_REGRESSION'; end if;
  return new;
end
$function$;
create trigger channel_syncrun_checkpoint before update on channel.syncrun
for each row execute function channel.guard_syncrun_checkpoint();

create function channel.guard_webhook_evidence() returns trigger language plpgsql set search_path=pg_catalog,channel as $function$
begin
  if new.version<>old.version+1 then raise exception 'CHANNEL_WEBHOOK_VERSION_INVALID'; end if;
  if (new.id,new.connection_id,new.provider,new.scope_id,new.external_id,new.raw_ciphertext,new.raw_key_version,
    new.raw_hash,new.signature_hash,new.received_at,new.watermark,new.trace_id) is distinct from
    (old.id,old.connection_id,old.provider,old.scope_id,old.external_id,old.raw_ciphertext,old.raw_key_version,
      old.raw_hash,old.signature_hash,old.received_at,old.watermark,old.trace_id) then raise exception 'CHANNEL_WEBHOOK_EVIDENCE_IMMUTABLE'; end if;
  return new;
end
$function$;
create trigger channel_webhookinbox_evidence before update on channel.webhookinbox
for each row execute function channel.guard_webhook_evidence();

select runtime.record_migration_evidence('20260904030700',before.rows_count,after.rows_count,0,0,
  'select provider,scope_id,status,contract_version,capability_snapshot,version from channel.connection order by provider,scope_id;',
  'select id,state,phase,cursor_value,watermark,failure_class,failure_code,failure_retryable,version from channel.syncrun order by id;')
from channel_model_before before cross join (
  select (select count(*) from channel.connection)+(select count(*) from channel.syncrun)+
    (select count(*) from channel.externalobject)+(select count(*) from channel.webhookinbox) rows_count
) after;

insert into runtime.schemaversion(version,checksum)
values('20260904030700',encode(public.digest('20260904030700_enrich_channel_models','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from channel.connection where jsonb_array_length(capability_snapshot)=0) then raise exception 'CHANNEL_CAPABILITY_SNAPSHOT_EMPTY'; end if;
  if exists(select 1 from channel.syncrun where (state='failed')<>(failure_class is not null)) then raise exception 'CHANNEL_SYNC_FAILURE_CLASSIFICATION_INVALID'; end if;
  if exists(select 1 from channel.webhookinbox where (state='failed')<>(failure_class is not null)) then raise exception 'CHANNEL_WEBHOOK_FAILURE_CLASSIFICATION_INVALID'; end if;
  if (select count(*) from pg_trigger where tgrelid in('channel.syncrun'::regclass,'channel.webhookinbox'::regclass)
    and tgname in('channel_syncrun_checkpoint','channel_webhookinbox_evidence') and not tgisinternal)<>2 then raise exception 'CHANNEL_MODEL_GUARD_MISSING'; end if;
end
$assert$;

commit;
