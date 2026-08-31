begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829113000') then raise exception 'NAVIGATION_IDENTITY_GRANT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829114000') then raise exception 'NAVIGATION_IDENTITY_GRANT_ALREADY_APPLIED'; end if;
end $precondition$;

alter table organization.directoryconnection enable row level security;
alter table organization.directoryconnection force row level security;
alter table organization.directorysubject enable row level security;
alter table organization.directorysubject force row level security;
alter table organization.directorymembership enable row level security;
alter table organization.directorymembership force row level security;
alter table organization.syncrun enable row level security;
alter table organization.syncrun force row level security;
alter table organization.directoryinbox enable row level security;
alter table organization.directoryinbox force row level security;
alter table runtime.errorcontract enable row level security;
alter table runtime.errorcontract force row level security;
create policy directoryconnectionapp on organization.directoryconnection for all to shopapp using(access.scope_allowed(organization_id)) with check(access.scope_allowed(organization_id));
create policy directoryconnectionjob on organization.directoryconnection for all to shopjob using(true) with check(true);
create policy directorysubjectapp on organization.directorysubject for select to shopapp using(exists(select 1 from organization.directoryconnection connection where connection.id=connection_id and access.scope_allowed(connection.organization_id)));
create policy directorysubjectjob on organization.directorysubject for all to shopjob using(true) with check(true);
create policy directorymembershipapp on organization.directorymembership for select to shopapp using(access.scope_allowed(organization_id));
create policy directorymembershipjob on organization.directorymembership for all to shopjob using(true) with check(true);
create policy syncrunapp on organization.syncrun for select to shopapp using(exists(select 1 from organization.directoryconnection connection where connection.id=connection_id and access.scope_allowed(connection.organization_id)));
create policy syncrunjob on organization.syncrun for all to shopjob using(true) with check(true);
create policy directoryinboxjob on organization.directoryinbox for all to shopjob using(true) with check(true);
create policy errorcontractapp on runtime.errorcontract for select to shopapp using(true);
create policy errorcontractjob on runtime.errorcontract for select to shopjob using(true);

create function organization.webhook_directory(p_connection uuid)
returns table(id uuid,tenant_id uuid,organization_id text,provider_instance_id uuid,type text,secret_ref text,cursor_ciphertext text,
  successful_version bigint,status text,version bigint)
language sql stable security definer set search_path=organization,identity,pg_temp as $function$
  select connection.id,connection.tenant_id,connection.organization_id,connection.provider_instance_id,provider.type,connection.secret_ref,
    connection.cursor_ciphertext,connection.successful_version,connection.status,connection.version
  from organization.directoryconnection connection join identity.provider provider on provider.id=connection.provider_instance_id
  where connection.id=p_connection and connection.status='enabled' and provider.status='enabled' and provider.type in('wecomcorp','wecomsuite')
$function$;

create function organization.receive_directory_event(p_connection uuid,p_event text,p_version bigint,p_hash char(64),p_envelope text)
returns text language plpgsql security definer set search_path=organization,runtime,pg_temp as $function$
declare outcome text;run_id uuid;
begin
  if not exists(select 1 from organization.directoryconnection where id=p_connection and status='enabled') then raise exception 'DIRECTORY_NOT_FOUND'; end if;
  if exists(select 1 from organization.directoryinbox where connection_id=p_connection and provider_event_id=p_event) then return 'duplicate'; end if;
  outcome:=case when coalesce((select max(provider_version) from organization.directoryinbox where connection_id=p_connection),0)>p_version then 'stale' else 'accepted' end;
  insert into organization.directoryinbox(connection_id,provider_event_id,provider_version,body_hash,envelope_ciphertext,state,received_at)
    values(p_connection,p_event,p_version,p_hash,p_envelope,case when outcome='stale' then 'stale' else 'received' end,clock_timestamp());
  if outcome='accepted' then
    run_id:=gen_random_uuid();
    insert into organization.syncrun(id,connection_id,provider_run_id,mode,state,created_at)
      values(run_id,p_connection,'event:'||p_event,'event','queued',clock_timestamp());
    insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values('job:'||gen_random_uuid(),'directorysync','organization',p_connection::text,
        jsonb_build_object('resource',p_connection::text,'connection',p_connection::text,'run',run_id::text),'queued',10,
        clock_timestamp(),clock_timestamp(),clock_timestamp());
  end if;
  return outcome;
end $function$;

grant select,insert,update on identity.provider,identity.federationtransaction,identity.preauth,identity.linkcase,identity.providersecretrotation to shopapp;
grant select,update,delete on identity.federationtransaction,identity.preauth to shopjob;
grant select on identity.provider,identity.linkcase,identity.providersecretrotation to shopjob;
grant select,insert,update on organization.directoryconnection,organization.syncrun to shopapp;
grant select on organization.directorysubject,organization.directorymembership to shopapp;
grant select,insert,update,delete on organization.directoryconnection,organization.directorysubject,organization.directorymembership,organization.syncrun,organization.directoryinbox to shopjob;
grant select on runtime.errorcontract to shopapp,shopjob;
grant execute on function organization.webhook_directory(uuid),organization.receive_directory_event(uuid,text,bigint,character,text) to shopapp;
revoke all on identity.provider,identity.federationtransaction,identity.preauth,identity.linkcase,identity.providersecretrotation from public;
revoke all on organization.directoryconnection,organization.directorysubject,organization.directorymembership,organization.syncrun,organization.directoryinbox from public;
revoke all on function organization.webhook_directory(uuid),organization.receive_directory_event(uuid,text,bigint,character,text) from public;

select runtime.record_migration_evidence('20260829114000',0,0,0,0,
  'create index concurrently if not exists organization_directoryconnection_scope_live on organization.directoryconnection(organization_id,id);',
  'select grantee,table_schema,table_name,privilege_type from information_schema.role_table_grants where table_name in(''provider'',''directoryconnection'') order by grantee,table_name;');
insert into runtime.schemaversion(version,checksum) values('20260829114000',encode(public.digest('20260829114000_grant_navigation_identity_access','sha256'),'hex'));

commit;
