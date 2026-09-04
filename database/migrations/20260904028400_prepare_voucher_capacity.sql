begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904028300') then raise exception 'VOUCHER_CAPACITY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904028400') then raise exception 'VOUCHER_CAPACITY_ALREADY_APPLIED'; end if;
end $precondition$;

create index voucher_stock_pool on voucher.stockrequest(scope_id,pool_id,product_id,id) include(quantity)
  where state in('submitted','approved','fulfilled');
create index voucher_issueorder_stock on voucher.issueorder(scope_id,stock_request_id,id) include(product_id,quantity,state);

select runtime.record_migration_evidence('20260904028400',0,0,0,0,
  'select indexname from pg_indexes where schemaname=''voucher'' and indexname in(''voucher_stock_pool'',''voucher_issueorder_stock'');',
  'select count(*) from runtime.schemaversion where version=''20260904028400'';');
insert into runtime.schemaversion(version,checksum)
values('20260904028400',encode(public.digest('20260904028400_prepare_voucher_capacity','sha256'),'hex'));

do $assert$ begin
  if to_regclass('voucher.voucher_stock_pool') is null or to_regclass('voucher.voucher_issueorder_stock') is null then
    raise exception 'VOUCHER_CAPACITY_INDEX_MISSING';
  end if;
end $assert$;

commit;
