begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904043000') then raise exception 'IDEAL_PARTNER_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904044000') then raise exception 'IDEAL_PARTNER_ALREADY_APPLIED'; end if;
  if (select count(*) from information_schema.tables where table_schema='partner' and table_name in(
    'customer','customercontact','customeragreement'))<>3 then raise exception 'IDEAL_PARTNER_TABLES_MISSING'; end if;
end
$precondition$;

create unique index if not exists partner_customer_tenant_identifier on partner.customer(tenant_id,identifier_hash);

select runtime.record_migration_evidence('20260904044000',
  (select count(*) from partner.customer),(select count(*) from partner.customer),0,0,
  'select tenant_id,status,count(*) from partner.customer group by tenant_id,status;',
  'select tenant_id,identifier_hash,count(*) from partner.customer group by tenant_id,identifier_hash having count(*)>1;');
insert into runtime.schemaversion(version,checksum)
values('20260904044000',encode(public.digest('20260904044000_prepare_partner_customers','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from partner.customer where identifier_ciphertext='' or identifier_hash!~'^[0-9a-f]{64}$'
    or identifier_key_version='' or identifier_masked='') then raise exception 'IDEAL_CUSTOMER_IDENTIFIER_PROTECTION_INVALID'; end if;
  if exists(select 1 from partner.customercontact where name_ciphertext='' or name_hash!~'^[0-9a-f]{64}$'
    or name_key_version='') then raise exception 'IDEAL_CUSTOMER_CONTACT_PROTECTION_INVALID'; end if;
end
$assert$;

commit;
