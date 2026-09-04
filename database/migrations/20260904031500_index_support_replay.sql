begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904031400') then raise exception 'SUPPORT_REPLAY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904031500') then raise exception 'SUPPORT_REPLAY_ALREADY_APPLIED'; end if;
end
$precondition$;

create index runtime_outbox_support_cursor on runtime.outbox(realtime_cursor)
where event_type like 'support.%' and realtime_cursor is not null;
create index runtime_outbox_support_replay on runtime.outbox(realtime_published_at,id)
where event_type like 'support.%' and realtime_cursor is not null;

select runtime.record_migration_evidence(
  '20260904031500',0,0,0,0,
  'select scope_id,realtime_cursor,event_type from runtime.outbox where event_type like ''support.%'' and realtime_cursor is not null order by realtime_published_at,id;',
  'select indexname,indexdef from pg_indexes where schemaname=''runtime'' and indexname like ''runtime_outbox_support_%'' order by indexname;'
);

insert into runtime.schemaversion(version,checksum)
values('20260904031500',encode(public.digest('20260904031500_index_support_replay','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from pg_indexes where schemaname='runtime' and indexname in('runtime_outbox_support_cursor','runtime_outbox_support_replay'))<>2 then raise exception 'SUPPORT_REPLAY_INDEX_MISSING'; end if;
end
$assert$;

commit;
