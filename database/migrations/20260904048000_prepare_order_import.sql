begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904047000') then raise exception 'IDEAL_ORDER_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904048000') then raise exception 'IDEAL_ORDER_ALREADY_APPLIED'; end if;
  if to_regclass('ordering.orderrecord') is null or to_regclass('ordering.importreceipt') is null
    or to_regclass('ordering.stateevent') is null then raise exception 'IDEAL_ORDER_TABLES_MISSING'; end if;
end
$precondition$;

create index if not exists ordering_order_states on ordering.orderrecord(
  scope_id,lifecycle_state,payment_state,fulfillment_state,aftersale_state,ordered_at desc,id);

select runtime.record_migration_evidence('20260904048000',
  (select count(*) from ordering.orderrecord),(select count(*) from ordering.orderrecord),
  (select coalesce(sum(total_minor),0) from ordering.orderrecord),(select coalesce(sum(total_minor),0) from ordering.orderrecord),
  'select scope_id,lifecycle_state,payment_state,fulfillment_state,aftersale_state,count(*),sum(total_minor) from ordering.orderrecord group by scope_id,lifecycle_state,payment_state,fulfillment_state,aftersale_state;',
  'select source_channel,external_reference,count(*) from ordering.orderrecord where external_reference is not null group by source_channel,external_reference having count(*)>1;');
insert into runtime.schemaversion(version,checksum)
values('20260904048000',encode(public.digest('20260904048000_prepare_order_import','sha256'),'hex'));

do $assert$
begin
  if exists(select source_channel,external_reference from ordering.orderrecord where external_reference is not null
    group by source_channel,external_reference having count(*)>1) then raise exception 'IDEAL_ORDER_EXTERNAL_DUPLICATE'; end if;
  if exists(select 1 from ordering.orderrecord where amount_snapshot is null or ordered_at is null)
    then raise exception 'IDEAL_ORDER_SNAPSHOT_MISSING'; end if;
end
$assert$;

commit;
