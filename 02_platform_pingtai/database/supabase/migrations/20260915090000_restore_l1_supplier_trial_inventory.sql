begin;

-- The supplier-network source of truth defined these ten trial SKUs and their
-- opening stock. Restore only rows that are absent; never overwrite a live
-- stock balance, reservation, movement, or registered historical migration.
select pg_advisory_xact_lock(hashtext('zhudatuan:l1:supplier-trial-inventory-recovery:v1'));

create temporary table l1_supplier_trial_inventory_recovery(
  id text primary key,
  sku_id text not null,
  onhand bigint not null
) on commit drop;

insert into l1_supplier_trial_inventory_recovery(id,sku_id,onhand) values
  ('stock:zdt:supplier:trial:001','sku:zdt:supplier:trial:001',50000),
  ('stock:zdt:supplier:trial:002','sku:zdt:supplier:trial:002',48000),
  ('stock:zdt:supplier:trial:003','sku:zdt:supplier:trial:003',46000),
  ('stock:zdt:supplier:trial:004','sku:zdt:supplier:trial:004',44000),
  ('stock:zdt:supplier:trial:005','sku:zdt:supplier:trial:005',42000),
  ('stock:zdt:supplier:trial:006','sku:zdt:supplier:trial:006',40000),
  ('stock:zdt:supplier:trial:007','sku:zdt:supplier:trial:007',38000),
  ('stock:zdt:supplier:trial:008','sku:zdt:supplier:trial:008',36000),
  ('stock:zdt:supplier:trial:009','sku:zdt:supplier:trial:009',34000),
  ('stock:zdt:supplier:trial:010','sku:zdt:supplier:trial:010',32000);

do $recovery$
begin
  if exists(
    select 1
    from inventory.stockitem stock
    join l1_supplier_trial_inventory_recovery source on source.id=stock.id
    where stock.scope_id<>'mall:d1708f04df2dd8a61736852c4900fb43'
       or stock.sku_id<>source.sku_id
  ) then
    raise exception 'L1_SUPPLIER_TRIAL_INVENTORY_IDENTITY_CONFLICT';
  end if;
end
$recovery$;

with restored as (
  insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
  select source.id,'mall:d1708f04df2dd8a61736852c4900fb43',source.sku_id,
    'location:zdt:supplier:central',source.onhand,greatest((source.onhand*2/100)::bigint,1),0,'active',clock_timestamp()
  from l1_supplier_trial_inventory_recovery source
  join catalog.sku sku on sku.id=source.sku_id and sku.status='active'
  join catalog.listing listing on listing.sku_id=source.sku_id
    and listing.scope_id='mall:d1708f04df2dd8a61736852c4900fb43'
    and listing.status='published'
  on conflict(id) do nothing
  returning id,onhand
)
insert into inventory.snapshot(stockitem_id,observed_at,source,onhand,source_version)
select id,clock_timestamp(),'supplier-catalog-recovery',onhand,'supplier-catalog-2026.09.12-recovery-v1'
from restored;

commit;
