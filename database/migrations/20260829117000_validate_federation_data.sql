begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829116000') then raise exception 'FEDERATION_VALIDATE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829117000') then raise exception 'FEDERATION_VALIDATE_ALREADY_APPLIED'; end if;
end $precondition$;

insert into identity.provider(id,tenant_id,type,provider_tenant_hash,issuer_hash,client_id_hash,secret_ref,redirect_uri,scopes,status,version)
select (substr(md5('migration:'||identity.application_hash),1,8)||'-'||substr(md5('migration:'||identity.application_hash),9,4)||'-4'||
  substr(md5('migration:'||identity.application_hash),14,3)||'-8'||substr(md5('migration:'||identity.application_hash),18,3)||'-'||
  substr(md5('migration:'||identity.application_hash),21,12))::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,'wechat',public.digest(identity.application_hash,'sha256'),null,
  public.digest(identity.application_hash,'sha256'),'identity/migration/wechat','https://passport.fufu.wang/api/v1/identity/federations/callback',
  array['snsapi_base'], 'disabled',0
from identity.federatedidentity identity group by identity.application_hash
on conflict(id) do nothing;

update identity.federatedidentity identity set
  provider_instance_id=provider.id,
  provider_tenant_hash=provider.provider_tenant_hash,
  normalized_subject_hash=public.digest(identity.subject_hash,'sha256'),
  linked_at=coalesce(identity.bound_at,identity.created_at),
  verified_at=coalesce(identity.bound_at,identity.created_at),
  last_seen_at=identity.updated_at,
  source='migration'
from identity.provider provider
where provider.type='wechat' and provider.tenant_id='00000000-0000-0000-0000-000000000000'::uuid
  and provider.client_id_hash=public.digest(identity.application_hash,'sha256') and identity.provider_instance_id is null;

insert into identity.linkcase(id,provider_id,tenant_id,subject_hash,candidate_principal_id,candidate_membership_id,reason,status,version)
select (substr(md5('linkcase:'||identity.id),1,8)||'-'||substr(md5('linkcase:'||identity.id),9,4)||'-4'||
  substr(md5('linkcase:'||identity.id),14,3)||'-8'||substr(md5('linkcase:'||identity.id),18,3)||'-'||
  substr(md5('linkcase:'||identity.id),21,12))::uuid,
  identity.provider_instance_id,'00000000-0000-0000-0000-000000000000'::uuid,identity.normalized_subject_hash,
  identity.principal_id,identity.membership_id,case when identity.principal_id is null then 'unlinked' else 'tenantunknown' end,'open',0
from identity.federatedidentity identity
where identity.status<>'revoked' and not exists(select 1 from identity.linkcase linkcase where linkcase.subject_hash=identity.normalized_subject_hash and linkcase.provider_id=identity.provider_instance_id);

alter table identity.federatedidentity alter column provider_instance_id set not null;
alter table identity.federatedidentity alter column provider_tenant_hash set not null;
alter table identity.federatedidentity alter column normalized_subject_hash set not null;
alter table identity.federatedidentity add constraint identity_federated_provider_tenant check(octet_length(provider_tenant_hash)=32) not valid;
alter table identity.federatedidentity add constraint identity_federated_normalized_subject check(octet_length(normalized_subject_hash)=32) not valid;
alter table identity.federatedidentity validate constraint identity_federated_provider_tenant;
alter table identity.federatedidentity validate constraint identity_federated_normalized_subject;

do $validate$ begin
  if exists(select 1 from identity.federatedidentity where provider_instance_id is null or provider_tenant_hash is null or normalized_subject_hash is null) then raise exception 'FEDERATION_BACKFILL_INCOMPLETE'; end if;
  if exists(select 1 from identity.federatedidentity where status='active' group by provider_instance_id,provider_tenant_hash,normalized_subject_hash having count(distinct principal_id)>1) then raise exception 'FEDERATION_PRINCIPAL_CONFLICT'; end if;
  if exists(select 1 from organization.directorymembership membership left join organization.directorysubject subject on subject.id=membership.subject_id where subject.id is null) then raise exception 'DIRECTORY_SUBJECT_ORPHAN'; end if;
end $validate$;

select runtime.record_migration_evidence('20260829117000',
  (select count(*) from identity.federatedidentity),(select count(*) from identity.federatedidentity),0,0,
  'create unique index concurrently if not exists identity_federated_active_subject_live on identity.federatedidentity(provider_instance_id,provider_tenant_hash,normalized_subject_hash) where status=''active'';',
  'select status,count(*) from identity.linkcase group by status order by status;');
insert into runtime.schemaversion(version,checksum) values('20260829117000',encode(public.digest('20260829117000_validate_federation_data','sha256'),'hex'));

commit;
