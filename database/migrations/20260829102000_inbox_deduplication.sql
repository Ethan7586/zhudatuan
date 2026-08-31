begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829101000') then raise exception 'INBOX_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829102000')
    or exists(select 1 from information_schema.columns where table_schema='runtime' and table_name='inbox' and column_name='provider') then
    raise exception 'INBOX_ALREADY_APPLIED';
  end if;
end $precondition$;

create temporary table inbox_reconcile on commit drop as select count(*)::bigint rows,0::numeric minor from runtime.inbox;
alter table runtime.inbox add column provider text;
alter table runtime.inbox add column operation text;
update runtime.inbox set provider=case when consumer like 'provider.%' then substring(consumer from 10) else 'internal' end,
  operation=consumer;
alter table runtime.inbox alter column provider set not null;
alter table runtime.inbox alter column operation set not null;
alter table runtime.inbox add constraint runtime_inbox_provider check(provider~'^[a-z][a-z0-9.-]{1,127}$') not valid;
alter table runtime.inbox add constraint runtime_inbox_operation check(operation~'^[a-z][a-z0-9:.-]{1,191}$') not valid;
alter table runtime.inbox validate constraint runtime_inbox_provider;
alter table runtime.inbox validate constraint runtime_inbox_operation;
alter table runtime.inbox drop constraint inbox_pkey;
alter table runtime.inbox add primary key(provider,event_id,operation);
create index runtime_inbox_operation_pending on runtime.inbox(operation,received_at,event_id) where processed_at is null;

drop function runtime.accept_inbox(text,text,text,integer,text,jsonb);
create function runtime.accept_inbox(p_provider text,p_event_id text,p_operation text,p_event_type text,p_event_version integer,p_trace_id text,p_payload jsonb)
returns boolean language plpgsql security definer set search_path=runtime,pg_temp as $function$
begin
  if p_provider is null or p_operation is null then raise exception 'INBOX_IDENTITY_REQUIRED'; end if;
  insert into runtime.inbox(provider,event_id,operation,consumer,event_type,event_version,trace_id,payload,received_at)
  values(p_provider,p_event_id,p_operation,p_operation,p_event_type,p_event_version,p_trace_id,p_payload,clock_timestamp())
  on conflict(provider,event_id,operation) do nothing;
  return found;
end $function$;
revoke all on function runtime.accept_inbox(text,text,text,text,integer,text,jsonb) from public,shopapp;
grant execute on function runtime.accept_inbox(text,text,text,text,integer,text,jsonb) to shopjob;

create or replace function runtime.accept_provider_webhook(p_provider text,p_external_id text,p_sha256 text,p_headers jsonb,p_payload text,p_trace_id text,p_event_type text,p_event_version integer,p_event_payload jsonb)
returns text language plpgsql security definer set search_path=runtime,pg_temp as $function$
begin
  insert into runtime.rawenvelope(provider,external_id,sha256,headers,payload,trace_id,received_at)
  values(p_provider,p_external_id,p_sha256,p_headers,p_payload,p_trace_id,clock_timestamp()) on conflict(provider,external_id) do nothing;
  if not found then
    if not exists(select 1 from runtime.rawenvelope where provider=p_provider and external_id=p_external_id and sha256=p_sha256) then raise exception 'PROVIDER_EVENT_ID_COLLISION'; end if;
    return 'replayed';
  end if;
  perform runtime.accept_inbox(p_provider,p_provider||':'||p_external_id,'webhook:'||p_event_type,p_event_type,p_event_version,p_trace_id,p_event_payload);
  return 'accepted';
end $function$;

select runtime.record_migration_evidence('20260829102000',(select rows from inbox_reconcile),(select count(*) from runtime.inbox),0,0,
  'create index concurrently if not exists runtime_inbox_pending_live on runtime.inbox(operation,received_at,event_id) where processed_at is null;',
  'select provider,event_id,operation,count(*) from runtime.inbox group by provider,event_id,operation having count(*)>1;');
insert into runtime.schemaversion(version,checksum)
values('20260829102000',encode(public.digest('20260829102000_inbox_deduplication','sha256'),'hex'));

commit;
