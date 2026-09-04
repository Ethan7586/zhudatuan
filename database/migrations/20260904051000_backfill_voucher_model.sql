begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904050000') then raise exception 'IDEAL_VOUCHER_BACKFILL_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904051000') then raise exception 'IDEAL_VOUCHER_BACKFILL_ALREADY_APPLIED'; end if;
end
$precondition$;

insert into voucher.migrationsource(tenant_id,scope_id,source_table,source_id,target_table,target_id,source_hash,migrated_by,migrated_at,version)
select source.scope_id,source.scope_id,'program',source.id,'product',target.id,
  encode(public.digest(row_to_json(source)::text,'sha256'),'hex'),'migration:voucher',clock_timestamp(),1
from voucher.legacyprogram source join voucher.product target on target.id=source.id;
insert into voucher.migrationsource(tenant_id,scope_id,source_table,source_id,target_table,target_id,source_hash,migrated_by,migrated_at,version)
select source.scope_id,source.scope_id,'cardpool',source.id,'credentialpool',target.id,
  encode(public.digest(row_to_json(source)::text,'sha256'),'hex'),'migration:voucher',clock_timestamp(),1
from voucher.legacycardpool source join voucher.credentialpool target on target.id=source.id;
insert into voucher.migrationsource(tenant_id,scope_id,source_table,source_id,target_table,target_id,source_hash,migrated_by,migrated_at,version)
select pool.scope_id,pool.scope_id,'credential',source.id,'credential',target.id,
  encode(public.digest(row_to_json(source)::text,'sha256'),'hex'),'migration:voucher',clock_timestamp(),1
from voucher.legacycredential source join voucher.legacycardpool pool on pool.id=source.cardpool_id
join voucher.credential target on target.id=source.id;
insert into voucher.migrationsource(tenant_id,scope_id,source_table,source_id,target_table,target_id,source_hash,migrated_by,migrated_at,version)
select product.scope_id,product.scope_id,'issuebatch',source.id,'issuebatch',target.id,
  encode(public.digest(row_to_json(source)::text,'sha256'),'hex'),'migration:voucher',clock_timestamp(),1
from voucher.legacyissuebatch source join voucher.product product on product.id=source.program_id
join voucher.issuebatch target on target.id=source.id;
insert into voucher.migrationsource(tenant_id,scope_id,source_table,source_id,target_table,target_id,source_hash,migrated_by,migrated_at,version)
select target.scope_id,target.scope_id,'voucher',source.id,'voucher',target.id,
  encode(public.digest(row_to_json(source)::text,'sha256'),'hex'),'migration:voucher',clock_timestamp(),1
from voucher.legacyvoucher source join voucher.voucher target on target.id=source.id;
insert into voucher.migrationsource(tenant_id,scope_id,source_table,source_id,target_table,target_id,source_hash,migrated_by,migrated_at,version)
select target.scope_id,target.scope_id,'reserve',source.id,'tenderhold',target.id,
  encode(public.digest(row_to_json(source)::text,'sha256'),'hex'),'migration:voucher',clock_timestamp(),1
from voucher.legacyreserve source join voucher.tenderhold target on target.id=source.id;
insert into voucher.migrationsource(tenant_id,scope_id,source_table,source_id,target_table,target_id,source_hash,migrated_by,migrated_at,version)
select target.scope_id,target.scope_id,'redemption',source.id,'redemption',target.id,
  encode(public.digest(row_to_json(source)::text,'sha256'),'hex'),'migration:voucher',clock_timestamp(),1
from voucher.legacyredemption source join voucher.redemption target on target.id=source.id;
insert into voucher.migrationsource(tenant_id,scope_id,source_table,source_id,target_table,target_id,source_hash,migrated_by,migrated_at,version)
select target.scope_id,target.scope_id,'refund',source.id,'refund',target.id,
  encode(public.digest(row_to_json(source)::text,'sha256'),'hex'),'migration:voucher',clock_timestamp(),1
from voucher.legacyrefund source join voucher.refund target on target.id=source.id where source.state='reversed';

select runtime.record_migration_evidence('20260904051000',
  (select count(*) from voucher.legacyprogram)+(select count(*) from voucher.legacycardpool)+(select count(*) from voucher.legacycredential)
    +(select count(*) from voucher.legacyissuebatch)+(select count(*) from voucher.legacyvoucher)+(select count(*) from voucher.legacyreserve)
    +(select count(*) from voucher.legacyredemption)+(select count(*) from voucher.legacyrefund where state='reversed'),
  (select count(*) from voucher.migrationsource),0,0,
  'select source_table,count(*) from voucher.migrationsource group by source_table order by source_table;',
  'select source_table,source_id,target_table,target_id,source_hash from voucher.migrationsource order by source_table,source_id;');
insert into runtime.schemaversion(version,checksum)
values('20260904051000',encode(public.digest('20260904051000_backfill_voucher_model','sha256'),'hex'));

commit;
