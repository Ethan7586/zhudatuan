begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829118000') then raise exception 'DIRECTORY_INTEGRITY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260830100000') then raise exception 'DIRECTORY_INTEGRITY_ALREADY_APPLIED'; end if;
end $precondition$;

create or replace function organization.receive_directory_event(
  p_connection uuid,p_event text,p_version bigint,p_hash char(64),p_envelope text
) returns text language plpgsql security definer set search_path=organization,runtime,pg_temp as $function$
declare latest bigint;run_id uuid;inserted integer;
begin
  perform 1 from organization.directoryconnection where id=p_connection and status='enabled' for update;
  if not found then raise exception 'DIRECTORY_NOT_FOUND'; end if;
  select greatest(connection.successful_version,coalesce(max(inbox.provider_version),0)) into latest
  from organization.directoryconnection connection
  left join organization.directoryinbox inbox on inbox.connection_id=connection.id
  where connection.id=p_connection group by connection.successful_version;
  insert into organization.directoryinbox(connection_id,provider_event_id,provider_version,body_hash,envelope_ciphertext,state,received_at)
    values(p_connection,p_event,p_version,p_hash,p_envelope,case when p_version<latest then 'stale' else 'received' end,clock_timestamp())
    on conflict(connection_id,provider_event_id) do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then return 'duplicate'; end if;
  if p_version<latest then return 'stale'; end if;
  run_id:=gen_random_uuid();
  insert into organization.syncrun(id,connection_id,provider_run_id,mode,state,created_at)
    values(run_id,p_connection,'event:'||p_event,'event','queued',clock_timestamp());
  insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values('job:'||gen_random_uuid(),'directorysync','organization',p_connection::text,
      jsonb_build_object('resource',p_connection::text,'connection',p_connection::text,'run',run_id::text),'queued',10,
      clock_timestamp(),clock_timestamp(),clock_timestamp());
  return 'accepted';
end $function$;

revoke all on function organization.receive_directory_event(uuid,text,bigint,character,text) from public;
grant execute on function organization.receive_directory_event(uuid,text,bigint,character,text) to shopapp;

alter table organization.syncrun add constraint organization_syncrun_completed_checksum
  check(state<>'completed' or checksum is not null) not valid;
alter table organization.syncrun validate constraint organization_syncrun_completed_checksum;

select runtime.record_migration_evidence('20260830100000',0,0,0,0,
  'select organization.receive_directory_event($1,$2,$3,$4,$5);',
  'select connection_id,provider_event_id,count(*) from organization.directoryinbox group by connection_id,provider_event_id having count(*)>1;');
insert into runtime.schemaversion(version,checksum)
values('20260830100000',encode(public.digest('20260830100000_directory_sync_integrity','sha256'),'hex'));

commit;
