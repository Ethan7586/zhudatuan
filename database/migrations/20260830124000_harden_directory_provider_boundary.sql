begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830123000') then raise exception 'DIRECTORY_PROVIDER_BOUNDARY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260830124000') then raise exception 'DIRECTORY_PROVIDER_BOUNDARY_ALREADY_APPLIED'; end if;
end $precondition$;

alter table identity.provider add constraint identity_provider_directory_reference
  unique(id,tenant_id,type,secret_ref,status);

alter table organization.directoryconnection
  add column provider_type text,
  add column provider_status text;

update organization.directoryconnection connection set provider_type=provider.type,provider_status=provider.status
from identity.provider provider where provider.id=connection.provider_instance_id;

alter table organization.directoryconnection
  alter column provider_type set not null,
  alter column provider_status set not null,
  add constraint directoryconnection_provider_type check(provider_type in('wecomcorp','wecomsuite')),
  add constraint directoryconnection_provider_status check(provider_status in('draft','enabled','disabled','revoked')),
  add constraint directoryconnection_provider_reference foreign key(provider_instance_id,tenant_id,provider_type,secret_ref,provider_status)
    references identity.provider(id,tenant_id,type,secret_ref,status) on update cascade;

drop function organization.webhook_directory(uuid);
create function organization.webhook_directory(p_connection uuid)
returns table(id uuid,tenant_id uuid,organization_id text,provider_instance_id uuid,provider_type text,secret_ref text,
  cursor_ciphertext text,successful_version bigint,status text,version bigint)
language sql stable security definer set search_path=organization,pg_temp as $function$
  select connection.id,connection.tenant_id,connection.organization_id,connection.provider_instance_id,connection.provider_type,
    connection.secret_ref,connection.cursor_ciphertext,connection.successful_version,connection.status,connection.version
  from organization.directoryconnection connection
  where connection.id=p_connection and connection.status='enabled' and connection.provider_status='enabled'
$function$;

grant execute on function organization.webhook_directory(uuid) to shopapp;
revoke all on function organization.webhook_directory(uuid) from public;

select runtime.record_migration_evidence('20260830124000',0,0,0,0,
  'create index concurrently if not exists organization_directoryconnection_provider_live on organization.directoryconnection(provider_instance_id,provider_status,id);',
  'select provider_instance_id,tenant_id,provider_type,provider_status,count(*) from organization.directoryconnection group by provider_instance_id,tenant_id,provider_type,provider_status having count(*)>1;');
insert into runtime.schemaversion(version,checksum) values('20260830124000',encode(public.digest('20260830124000_harden_directory_provider_boundary','sha256'),'hex'));

commit;
