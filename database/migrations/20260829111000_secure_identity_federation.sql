begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829110000') then raise exception 'SECURE_IDENTITY_FEDERATION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829111000') then raise exception 'SECURE_IDENTITY_FEDERATION_ALREADY_APPLIED'; end if;
end $precondition$;

create unique index identity_provider_active on identity.provider(tenant_id,type,provider_tenant_hash,client_id_hash) where status<>'revoked';
create unique index identity_federated_active_subject on identity.federatedidentity(provider_instance_id,provider_tenant_hash,normalized_subject_hash) where status='active';
create index identity_federation_expiry on identity.federationtransaction(status,expires_at,id);
create index identity_federation_provider_created on identity.federationtransaction(provider_id,created_at,id);
create unique index identity_federation_returntarget_once on identity.federationtransaction(return_target_hash);
create index identity_preauth_expiry on identity.preauth(expires_at,id) where consumed_at is null;
create index identity_linkcase_open on identity.linkcase(tenant_id,created_at,id) where status='open';

create function identity.protect_federation_consumption() returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $function$
begin
  if old.consumed_at is not null and new.consumed_at is distinct from old.consumed_at then raise exception 'FEDERATION_CONSUMPTION_IMMUTABLE'; end if;
  if new.version<>old.version+1 then raise exception 'FEDERATION_VERSION_SEQUENCE_INVALID'; end if;
  return new;
end $function$;
revoke all on function identity.protect_federation_consumption() from public,shopapp,shopjob;
create trigger identity_federation_transition before update on identity.federationtransaction for each row execute function identity.protect_federation_consumption();

create function identity.protect_linkcase_transition() returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $function$
begin
  if old.status<>'open' and new.status is distinct from old.status then raise exception 'LINKCASE_TERMINAL'; end if;
  if new.version<>old.version+1 then raise exception 'LINKCASE_VERSION_SEQUENCE_INVALID'; end if;
  return new;
end $function$;
revoke all on function identity.protect_linkcase_transition() from public,shopapp,shopjob;
create trigger identity_linkcase_transition before update on identity.linkcase for each row execute function identity.protect_linkcase_transition();

alter table identity.provider enable row level security;
alter table identity.provider force row level security;
alter table identity.federationtransaction enable row level security;
alter table identity.federationtransaction force row level security;
alter table identity.preauth enable row level security;
alter table identity.preauth force row level security;
alter table identity.linkcase enable row level security;
alter table identity.linkcase force row level security;
alter table identity.providersecretrotation enable row level security;
alter table identity.providersecretrotation force row level security;
create policy providerapp on identity.provider for all to shopapp using(tenant_id::text=nullif(current_setting('app.tenant_id',true),'')) with check(tenant_id::text=nullif(current_setting('app.tenant_id',true),''));
create policy providerpublic on identity.provider for select to shopapp using(status='enabled');
create policy providerjob on identity.provider for select to shopjob using(true);
create policy federationapp on identity.federationtransaction for all to shopapp using(exists(select 1 from identity.provider provider where provider.id=provider_id and provider.tenant_id::text=nullif(current_setting('app.tenant_id',true),''))) with check(exists(select 1 from identity.provider provider where provider.id=provider_id and provider.tenant_id::text=nullif(current_setting('app.tenant_id',true),'')));
create policy federationpublic on identity.federationtransaction for all to shopapp
  using(exists(select 1 from identity.provider provider where provider.id=provider_id and provider.status='enabled'))
  with check(exists(select 1 from identity.provider provider where provider.id=provider_id and provider.status='enabled'));
create policy federationjob on identity.federationtransaction for all to shopjob using(true) with check(true);
create policy preauthapp on identity.preauth for all to shopapp using(exists(select 1 from identity.federationtransaction federation where federation.id=transaction_id)) with check(exists(select 1 from identity.federationtransaction federation where federation.id=transaction_id));
create policy preauthjob on identity.preauth for all to shopjob using(true) with check(true);
create policy linkcaseapp on identity.linkcase for all to shopapp using(tenant_id::text=nullif(current_setting('app.tenant_id',true),'')) with check(tenant_id::text=nullif(current_setting('app.tenant_id',true),''));
create policy linkcasepublic on identity.linkcase for insert to shopapp with check(
  exists(select 1 from identity.provider provider where provider.id=provider_id and provider.tenant_id=tenant_id and provider.status='enabled'));
create policy linkcasejob on identity.linkcase for select to shopjob using(true);
create policy rotationapp on identity.providersecretrotation for all to shopapp using(exists(select 1 from identity.provider provider where provider.id=provider_id and provider.tenant_id::text=nullif(current_setting('app.tenant_id',true),''))) with check(exists(select 1 from identity.provider provider where provider.id=provider_id and provider.tenant_id::text=nullif(current_setting('app.tenant_id',true),'')));
create policy rotationjob on identity.providersecretrotation for select to shopjob using(true);

select runtime.record_migration_evidence('20260829111000',0,0,0,0,
  'create index concurrently if not exists identity_federation_expiry_live on identity.federationtransaction(status,expires_at,id);',
  'select schemaname,tablename,policyname from pg_policies where schemaname=''identity'' and tablename in(''provider'',''federationtransaction'',''preauth'',''linkcase'',''providersecretrotation'');');
insert into runtime.schemaversion(version,checksum) values('20260829111000',encode(public.digest('20260829111000_secure_identity_federation','sha256'),'hex'));

commit;
