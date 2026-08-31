-- Generated from packages/contract/definitions by @shop/contractgen for the federation hard cut.
begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829112000') then raise exception 'NAVIGATION_CONTRACT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829113000') then raise exception 'NAVIGATION_CONTRACT_ALREADY_APPLIED'; end if;
end $precondition$;

alter table capability.operation drop constraint operation_audience_check;
alter table capability.operation add constraint operation_audience_check check(audience in('public','console','storefront','system','webhook')) not valid;
alter table capability.operation validate constraint operation_audience_check;
alter table capability.capability drop constraint capability_kind_check;
alter table capability.capability add constraint capability_kind_check check(kind in('operation','feature','uiblock','quota','entitlement')) not valid;
alter table capability.capability validate constraint capability_kind_check;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('navigation.tree.read','navigation','GET','/api/v1/navigation','2.0.0'),
  ('navigation.catalog.read','navigation','GET','/api/v1/navigation/catalog','2.0.0'),
  ('navigation.health.read','navigation','GET','/api/v1/navigation/health','2.0.0'),
  ('identity.providers.read','identity','GET','/api/v1/identity/providers','2.0.0'),
  ('identity.federations.start','identity','POST','/api/v1/identity/federations','2.0.0'),
  ('identity.federations.callback','identity','GET','/api/v1/identity/federations/{providerid}/callback','2.0.0'),
  ('identity.federations.selection.read','identity','GET','/api/v1/identity/federations/selection','2.0.0'),
  ('identity.federations.complete','identity','POST','/api/v1/identity/federations/selection','2.0.0'),
  ('identity.links.read','identity','GET','/api/v1/identity/links','2.0.0'),
  ('identity.links.create','identity','POST','/api/v1/identity/links','2.0.0'),
  ('identity.links.revoke','identity','DELETE','/api/v1/identity/links/{linkid}','2.0.0'),
  ('identity.providers.manage','identity','PUT','/api/v1/identity/providers/{providerid}','2.0.0'),
  ('identity.providers.test','identity','POST','/api/v1/identity/providers/{providerid}/tests','2.0.0'),
  ('organization.directories.read','organization','GET','/api/v1/organization/directories','2.0.0'),
  ('organization.directories.manage','organization','PUT','/api/v1/organization/directories/{directoryid}','2.0.0'),
  ('organization.directories.sync','organization','POST','/api/v1/organization/directories/{directoryid}/syncs','2.0.0'),
  ('organization.directories.syncruns.read','organization','GET','/api/v1/organization/directories/{directoryid}/syncruns','2.0.0'),
  ('organization.directoryevents.receive','organization','POST','/api/v1/organization/directories/{directoryid}/events','2.0.0')
on conflict(id) do update set owner=excluded.owner,method=excluded.method,path=excluded.path,contract_version=excluded.contract_version;

insert into capability.capability(id,kind,name,version,status)
select operation.id,'operation',operation.id,2,'active' from runtime.operation operation
where operation.id in('navigation.tree.read','navigation.catalog.read','navigation.health.read','identity.providers.read','identity.federations.start',
  'identity.federations.callback','identity.federations.selection.read','identity.federations.complete','identity.links.read','identity.links.create',
  'identity.links.revoke','identity.providers.manage','identity.providers.test','organization.directories.read','organization.directories.manage',
  'organization.directories.sync','organization.directories.syncruns.read','organization.directoryevents.receive')
on conflict(id) do update set kind=excluded.kind,name=excluded.name,version=excluded.version,status=excluded.status;
insert into capability.capability(id,kind,name,version,status) values
  ('identity.federation','entitlement','identity.federation',1,'active'),
  ('identity.directory','entitlement','identity.directory',1,'active')
on conflict(id) do update set kind=excluded.kind,name=excluded.name,version=excluded.version,status=excluded.status;

insert into access.permission(id,code,risk,status) values
  ('permission:navigationcatalogread','navigation.catalog.read','critical','active'),
  ('permission:identitylinkread','identity.link.read','elevated','active'),
  ('permission:identitylinkmanage','identity.link.manage','critical','active'),
  ('permission:identityprovidermanage','identity.provider.manage','critical','active'),
  ('permission:identityprovidertest','identity.provider.test','critical','active'),
  ('permission:organizationdirectoryread','organization.directory.read','high','active'),
  ('permission:organizationdirectorymanage','organization.directory.manage','critical','active'),
  ('permission:organizationdirectorysync','organization.directory.sync','critical','active')
on conflict(code) do update set risk=excluded.risk,status=excluded.status;

insert into capability.operation(operation_id,capability_id,permission_code,audience) values
  ('navigation.tree.read','navigation.tree.read',null,'public'),
  ('navigation.catalog.read','navigation.catalog.read','navigation.catalog.read','console'),
  ('navigation.health.read','navigation.health.read','runtime.health.read','system'),
  ('identity.providers.read','identity.providers.read',null,'public'),
  ('identity.federations.start','identity.federations.start',null,'public'),
  ('identity.federations.callback','identity.federations.callback',null,'public'),
  ('identity.federations.selection.read','identity.federations.selection.read',null,'public'),
  ('identity.federations.complete','identity.federations.complete',null,'public'),
  ('identity.links.read','identity.links.read','identity.link.read','public'),
  ('identity.links.create','identity.links.create','identity.link.manage','public'),
  ('identity.links.revoke','identity.links.revoke','identity.link.manage','public'),
  ('identity.providers.manage','identity.providers.manage','identity.provider.manage','console'),
  ('identity.providers.test','identity.providers.test','identity.provider.test','console'),
  ('organization.directories.read','organization.directories.read','organization.directory.read','console'),
  ('organization.directories.manage','organization.directories.manage','organization.directory.manage','console'),
  ('organization.directories.sync','organization.directories.sync','organization.directory.sync','console'),
  ('organization.directories.syncruns.read','organization.directories.syncruns.read','organization.directory.read','console'),
  ('organization.directoryevents.receive','organization.directoryevents.receive',null,'webhook')
on conflict(operation_id) do update set capability_id=excluded.capability_id,permission_code=excluded.permission_code,audience=excluded.audience;

insert into runtime.event(type,version,owner,schema_ref) values
  ('identity.federation.linked',1,'identity','contract://events/identity.federation.linked/v1'),
  ('identity.federation.rejected',1,'identity','contract://events/identity.federation.rejected/v1'),
  ('identity.provider.changed',1,'identity','contract://events/identity.provider.changed/v1'),
  ('organization.directory.changed',1,'organization','contract://events/organization.directory.changed/v1'),
  ('organization.directory.synced',1,'organization','contract://events/organization.directory.synced/v1'),
  ('organization.membership.changed',1,'organization','contract://events/organization.membership.changed/v1'),
  ('capability.changed',1,'capability','contract://events/capability.changed/v1'),
  ('navigation.catalog.changed',1,'navigation','contract://events/navigation.catalog.changed/v1')
on conflict(type,version) do update set owner=excluded.owner,schema_ref=excluded.schema_ref;

create table runtime.errorcontract(
  code text primary key,
  status smallint not null check(status between 400 and 599),
  retryable boolean not null,
  audit boolean not null,
  client text not null check(client in('message','retry','hidden')),
  contract_version text not null
);
insert into runtime.errorcontract(code,status,retryable,audit,client,contract_version) values
  ('ACCESS_VERSION_STALE',401,false,true,'message','2.0.0'),('DIRECTORY_SYNC_STALE',409,false,true,'message','2.0.0'),
  ('FEDERATION_CALLBACK_REJECTED',401,false,true,'message','2.0.0'),('FEDERATION_LINK_CONFLICT',409,false,true,'message','2.0.0'),
  ('FEDERATION_LINK_REQUIRED',409,false,true,'message','2.0.0'),('FEDERATION_SUBJECT_REVOKED',403,false,true,'message','2.0.0'),
  ('FEDERATION_TRANSACTION_CONSUMED',409,false,true,'message','2.0.0'),('FEDERATION_TRANSACTION_EXPIRED',401,false,true,'message','2.0.0'),
  ('FEDERATION_TRANSACTION_INVALID',401,false,true,'message','2.0.0'),('IDENTITY_PROVIDER_CONFIGURATION_INVALID',400,false,true,'message','2.0.0'),
  ('IDENTITY_PROVIDER_DISABLED',403,false,true,'message','2.0.0'),('IDENTITY_PROVIDER_UNAVAILABLE',503,true,true,'retry','2.0.0'),
  ('MEMBERSHIP_SELECTION_REQUIRED',409,false,true,'message','2.0.0'),('NAVIGATION_CATALOG_MISMATCH',409,false,true,'message','2.0.0'),
  ('NAVIGATION_EMPTY',404,false,true,'message','2.0.0'),('NAVIGATION_SCOPE_DENIED',403,false,true,'message','2.0.0')
on conflict(code) do update set status=excluded.status,retryable=excluded.retryable,audit=excluded.audit,client=excluded.client,contract_version=excluded.contract_version;

update runtime.contractcatalog set status='retired' where artifact='commerce' and status='active';
insert into runtime.contractcatalog(artifact,version,checksum,operation_count,event_count,status,published_at)
values('commerce','2.1.0','cfea25e32b9de999b6e10d2d8787c9a0a973d18f3c402af5b677a429635ad52c',
  (select count(*) from runtime.operation),(select count(*) from runtime.event),'active',clock_timestamp());

select runtime.record_migration_evidence('20260829113000',
  (select count(*) from runtime.operation),(select count(*) from capability.operation),0,0,
  'create index concurrently if not exists runtime_errorcontract_status_live on runtime.errorcontract(status,code);',
  'select artifact,version,checksum,status from runtime.contractcatalog order by published_at desc;');
insert into runtime.schemaversion(version,checksum) values('20260829113000',encode(public.digest('20260829113000_publish_navigation_identity_contract','sha256'),'hex'));

commit;
