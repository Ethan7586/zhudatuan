begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904030800') then raise exception 'CHANNEL_SYNC_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904030900') then raise exception 'CHANNEL_SYNC_ALREADY_APPLIED'; end if;
end
$precondition$;

create temporary table channel_sync_before on commit drop as
select count(*) rows_count from channel.syncrun;

update channel.syncrun run set error_summary=coalesce((
  select jsonb_agg(jsonb_build_object(
    'keyHash',case when item->>'keyHash'~'^[a-f0-9]{64}$' then item->>'keyHash'
      else encode(public.digest(coalesce(item->>'key',ordinality::text),'sha256'),'hex') end,
    'code',case when item->>'code'~'^[A-Z][A-Z0-9_]{2,127}$' then item->>'code' else 'CHANNEL_SYNC_ERROR_INVALID' end)
    order by ordinality)
  from jsonb_array_elements(run.error_summary) with ordinality failure(item,ordinality) where ordinality<=100
),'[]'::jsonb);

alter table channel.syncrun add constraint channel_syncrun_error_summary check(
  jsonb_typeof(error_summary)='array' and jsonb_array_length(error_summary)<=100 and pg_column_size(error_summary)<=32768);

create or replace function channel.guard_syncrun_checkpoint() returns trigger language plpgsql set search_path=pg_catalog,channel as $function$
declare summary jsonb;
begin
  if new.version<>old.version+1 then raise exception 'CHANNEL_SYNC_VERSION_INVALID'; end if;
  if (new.id,new.connection_id,new.kind,new.input_hash,new.input) is distinct from
    (old.id,old.connection_id,old.kind,old.input_hash,old.input) then raise exception 'CHANNEL_SYNC_IDENTITY_IMMUTABLE'; end if;
  if new.cursor_value is distinct from old.cursor_value and not (
    old.state='running' and old.phase='apply' and new.phase='commit' and new.state in('running','completed'))
    then raise exception 'CHANNEL_SYNC_CURSOR_UNCOMMITTED'; end if;
  if (new.pulled_count,new.accepted_count,new.rejected_count,new.error_summary) is distinct from
    (old.pulled_count,old.accepted_count,old.rejected_count,old.error_summary) and not (
      old.state='running' and old.phase='apply' and new.phase='commit' and new.state in('running','completed'))
    then raise exception 'CHANNEL_SYNC_PROGRESS_UNCOMMITTED'; end if;
  for summary in select value from jsonb_array_elements(new.error_summary) loop
    if jsonb_typeof(summary)<>'object' or summary-array['keyHash','code']<>'{}'::jsonb or
      not coalesce(summary->>'keyHash','')~'^[a-f0-9]{64}$' or not coalesce(summary->>'code','')~'^[A-Z][A-Z0-9_]{2,127}$'
      then raise exception 'CHANNEL_SYNC_ERROR_SUMMARY_UNSAFE'; end if;
  end loop;
  if old.watermark is not null and new.watermark<old.watermark then raise exception 'CHANNEL_SYNC_WATERMARK_REGRESSION'; end if;
  if not (
    (old.state='queued' and new.state='running' and old.phase='pull' and new.phase='pull') or
    (old.state='running' and new.state='running' and (
      old.phase='pull' and new.phase in('pull','apply') or old.phase='apply' and new.phase='commit' or old.phase='commit' and new.phase='pull')) or
    (old.state='running' and new.state='completed' and old.phase='apply' and new.phase='commit') or
    (old.state in('queued','running') and new.state='cancelled' and new.phase=old.phase) or
    (old.state in('queued','running') and new.state='failed' and new.phase=old.phase))
    then raise exception 'CHANNEL_SYNC_TRANSITION_INVALID'; end if;
  if (new.state in('completed','failed','cancelled'))<>(new.completed_at is not null) then raise exception 'CHANNEL_SYNC_COMPLETION_INVALID'; end if;
  return new;
end
$function$;

select runtime.record_migration_evidence('20260904030900',before.rows_count,after.rows_count,0,0,
  'select id,state,phase,cursor_value,watermark,version from channel.syncrun order by id;',
  'select id,state,phase,cursor_value,watermark,failure_class,failure_code,failure_retryable,version from channel.syncrun order by id;')
from channel_sync_before before cross join (select count(*) rows_count from channel.syncrun) after;

insert into runtime.schemaversion(version,checksum)
values('20260904030900',encode(public.digest('20260904030900_guard_channel_sync','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from channel.syncrun where accepted_count+rejected_count>pulled_count) then raise exception 'CHANNEL_SYNC_PROGRESS_INVALID'; end if;
  if (select count(*) from pg_trigger where tgrelid='channel.syncrun'::regclass and tgname='channel_syncrun_checkpoint' and not tgisinternal)<>1
    then raise exception 'CHANNEL_SYNC_GUARD_MISSING'; end if;
end
$assert$;

commit;
