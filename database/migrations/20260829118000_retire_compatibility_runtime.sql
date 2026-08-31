begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829117000') then raise exception 'FEDERATION_RETIRE_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829118000') then raise exception 'FEDERATION_RETIRE_ALREADY_APPLIED'; end if;
  if exists(select 1 from identity.linkcase where status='open') then raise exception 'FEDERATION_LINKCASE_BLOCKS_HARDCUT'; end if;
  if exists(select 1 from pg_roles where rolname like 'zhudatuan%') then raise exception 'LEGACY_ROLE_BLOCKS_HARDCUT'; end if;
end $precondition$;

drop function if exists identity.resolve_session_compatibility(text) cascade;
drop function if exists identity.exchange_legacy_ticket(text,text) cascade;
drop view if exists identity.legacy_session cascade;
drop trigger if exists identity_federatedidentity_dualwrite on identity.federatedidentity;
drop function if exists identity.federatedidentity_dualwrite() cascade;

alter table identity.federatedidentity drop constraint if exists federatedidentity_provider_application_hash_subject_hash_key;
alter table identity.federatedidentity drop column application_hash;
alter table identity.federatedidentity drop column subject_hash;
alter table identity.federatedidentity drop column union_hash;

do $assert$ begin
  if exists(select 1 from information_schema.columns where table_schema='identity' and table_name='federatedidentity' and column_name in('application_hash','subject_hash','union_hash')) then raise exception 'FEDERATION_LEGACY_COLUMNS_REMAIN'; end if;
  if exists(select 1 from capability.operation where audience not in('public','console','storefront','system','webhook')) then raise exception 'LEGACY_AUDIENCE_REMAINS'; end if;
end $assert$;

select runtime.record_migration_evidence('20260829118000',0,0,0,0,
  'create unique index concurrently if not exists identity_federated_active_subject_final on identity.federatedidentity(provider_instance_id,provider_tenant_hash,normalized_subject_hash) where status=''active'';',
  'select provider_instance_id,status,count(*) from identity.federatedidentity group by provider_instance_id,status order by provider_instance_id,status;');
insert into runtime.schemaversion(version,checksum) values('20260829118000',encode(public.digest('20260829118000_retire_compatibility_runtime','sha256'),'hex'));

commit;
