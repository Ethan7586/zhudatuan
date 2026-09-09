begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260909014000') then
    raise exception 'IDENTITY_TENANT_REFERENCE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260909015000') then
    raise exception 'IDENTITY_TENANT_REFERENCE_ALREADY_APPLIED';
  end if;
  if exists(
    select 1 from (
      select tenant_id::text tenant_id from identity.provider
      union all select tenant_id::text from identity.linkcase where tenant_id is not null
      union all select tenant_id::text from organization.directoryconnection
    ) reference
    left join organization.organization tenant on tenant.id=reference.tenant_id and tenant.kind='tenant'
    where tenant.id is null
  ) then raise exception 'IDENTITY_TENANT_REFERENCE_REMEDIATION_REQUIRED'; end if;
end
$precondition$;

drop function organization.webhook_directory(uuid);

drop policy providerapp on identity.provider;
drop policy federationapp on identity.federationtransaction;
drop policy linkcaseapp on identity.linkcase;
drop policy linkcasepublic on identity.linkcase;
drop policy rotationapp on identity.providersecretrotation;
drop policy providerhealthapp on identity.providerhealth;

alter table organization.directoryconnection drop constraint directoryconnection_provider_reference;
alter table identity.provider drop constraint identity_provider_directory_reference;

alter table identity.provider alter column tenant_id type text using tenant_id::text;
alter table identity.linkcase alter column tenant_id type text using tenant_id::text;
alter table organization.directoryconnection alter column tenant_id type text using tenant_id::text;

alter table identity.provider
  add constraint identity_provider_tenant_reference foreign key(tenant_id) references organization.organization(id),
  add constraint identity_provider_directory_reference unique(id,tenant_id,type,secret_ref,status);
alter table identity.linkcase
  add constraint identity_linkcase_tenant_reference foreign key(tenant_id) references organization.organization(id);
alter table organization.directoryconnection
  add constraint organization_directory_tenant_reference foreign key(tenant_id) references organization.organization(id),
  add constraint directoryconnection_provider_reference foreign key(provider_instance_id,tenant_id,provider_type,secret_ref,provider_status)
    references identity.provider(id,tenant_id,type,secret_ref,status) on update cascade;

create policy providerapp on identity.provider for all to shopapp
  using(tenant_id=nullif(current_setting('app.tenant_id',true),''))
  with check(tenant_id=nullif(current_setting('app.tenant_id',true),''));
create policy federationapp on identity.federationtransaction for all to shopapp
  using(exists(select 1 from identity.provider provider where provider.id=provider_id
    and provider.tenant_id=nullif(current_setting('app.tenant_id',true),'')))
  with check(exists(select 1 from identity.provider provider where provider.id=provider_id
    and provider.tenant_id=nullif(current_setting('app.tenant_id',true),'')));
create policy linkcaseapp on identity.linkcase for all to shopapp using(
  source='federation' and tenant_id=nullif(current_setting('app.tenant_id',true),'')
  or source='enrollment' and access.scope_allowed(organization_id)
) with check(
  source='federation' and tenant_id=nullif(current_setting('app.tenant_id',true),'')
  or source='enrollment' and access.scope_allowed(organization_id)
);
create policy linkcasepublic on identity.linkcase for insert to shopapp with check(
  source='federation' and exists(select 1 from identity.provider provider
    where provider.id=provider_id and provider.tenant_id=tenant_id and provider.status='enabled')
  or source='enrollment' and current_setting('app.operation_id',true)='identity.enrollments.complete'
    and exists(select 1 from identity.invitationclaim claim join identity.invitation invitation on invitation.id=claim.invitation_id
      where claim.id::text=reference_id and invitation.organization_id=organization_id and claim.state in('reserved','proofpending','proved'))
);
create policy rotationapp on identity.providersecretrotation for all to shopapp
  using(exists(select 1 from identity.provider provider where provider.id=provider_id
    and provider.tenant_id=nullif(current_setting('app.tenant_id',true),'')))
  with check(exists(select 1 from identity.provider provider where provider.id=provider_id
    and provider.tenant_id=nullif(current_setting('app.tenant_id',true),'')));
create policy providerhealthapp on identity.providerhealth for select to shopapp
  using(exists(select 1 from identity.provider provider where provider.id=provider_id
    and provider.tenant_id=nullif(current_setting('app.tenant_id',true),'')));

create function organization.webhook_directory(p_connection uuid)
returns table(id uuid,tenant_id text,organization_id text,provider_instance_id uuid,provider_type text,secret_ref text,
  cursor_ciphertext text,successful_version bigint,status text,version bigint)
language sql stable security definer set search_path=organization,pg_temp as $function$
  select connection.id,connection.tenant_id,connection.organization_id,connection.provider_instance_id,connection.provider_type,
    connection.secret_ref,connection.cursor_ciphertext,connection.successful_version,connection.status,connection.version
  from organization.directoryconnection connection
  where connection.id=p_connection and connection.status='enabled' and connection.provider_status='enabled'
$function$;

grant execute on function organization.webhook_directory(uuid) to shopapp;
revoke all on function organization.webhook_directory(uuid) from public;

select runtime.record_migration_evidence(
  '20260909015000',
  (select count(*) from identity.provider)+(select count(*) from identity.linkcase)+(select count(*) from organization.directoryconnection),
  (select count(*) from identity.provider provider join organization.organization tenant on tenant.id=provider.tenant_id and tenant.kind='tenant')+
  (select count(*) from identity.linkcase linkcase left join organization.organization tenant on tenant.id=linkcase.tenant_id and tenant.kind='tenant'
    where linkcase.tenant_id is null or tenant.id is not null)+
  (select count(*) from organization.directoryconnection connection join organization.organization tenant on tenant.id=connection.tenant_id and tenant.kind='tenant'),
  0,0,
  'select table_schema,table_name,data_type from information_schema.columns where column_name=''tenant_id'' and (table_schema,table_name) in((''identity'',''provider''),(''identity'',''linkcase''),(''organization'',''directoryconnection'')) order by table_schema,table_name;',
  'select provider.id,provider.tenant_id,tenant.kind from identity.provider provider join organization.organization tenant on tenant.id=provider.tenant_id order by provider.id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260909015000',encode(public.digest('20260909015000_unify_identity_tenant_reference','sha256'),'hex'));
update runtime.schemahead set
  migration_head='20260909015000',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:identity',published_at=clock_timestamp()
where artifact='commerce';

do $assert$
begin
  if (
    select count(*) from information_schema.columns
    where column_name='tenant_id' and data_type='text' and (table_schema,table_name) in(
      ('identity','provider'),('identity','linkcase'),('organization','directoryconnection'))
  )<>3 then raise exception 'IDENTITY_TENANT_REFERENCE_TYPE_INVALID'; end if;
  if (
    select count(*) from pg_constraint
    where conname in('identity_provider_tenant_reference','identity_linkcase_tenant_reference',
      'organization_directory_tenant_reference','directoryconnection_provider_reference')
  )<>4 then raise exception 'IDENTITY_TENANT_REFERENCE_CONSTRAINT_INVALID'; end if;
  if pg_get_function_result('organization.webhook_directory(uuid)'::regprocedure)
      not like '%tenant_id text%' then raise exception 'DIRECTORY_WEBHOOK_TENANT_TYPE_INVALID'; end if;
  if exists(
    select 1 from pg_policies where schemaname in('identity','organization')
      and policyname in('providerapp','federationapp','linkcaseapp','linkcasepublic','rotationapp','providerhealthapp')
      and (qual like '%tenant_id::text%' or with_check like '%tenant_id::text%')
  ) then raise exception 'IDENTITY_TENANT_COMPATIBILITY_CAST_REMAINS'; end if;
  if not exists(select 1 from runtime.schemahead where artifact='commerce'
    and migration_head='20260909015000' and migration_count=(select count(*) from runtime.schemaversion)) then
    raise exception 'IDENTITY_TENANT_REFERENCE_SCHEMA_HEAD_INVALID';
  end if;
end
$assert$;

commit;
