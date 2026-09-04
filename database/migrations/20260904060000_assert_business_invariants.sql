begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904059000') then raise exception 'IDEAL_BUSINESS_ASSERT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904060000') then raise exception 'IDEAL_BUSINESS_ASSERT_ALREADY_APPLIED'; end if;
end
$precondition$;

do $assert$
begin
  if exists(select 1 from ordering.orderrecord where scope_id='' or amount_snapshot is null)
    or exists(select 1 from voucher.voucher where scope_id='' or remaining_minor not between 0 and initial_minor)
    or exists(select 1 from finance.journal where scope_id='' or currency<>'CNY')
  then raise exception 'IDEAL_SCOPE_OR_AMOUNT_INVALID'; end if;
  if exists(select stock.id from inventory.stockitem stock where stock.onhand-stock.safety-
    coalesce((select sum(reservation.quantity) from inventory.reservation reservation
      where reservation.stockitem_id=stock.id and reservation.state='reserved'),0)<0)
  then raise exception 'IDEAL_INVENTORY_OVERSELL'; end if;
  if exists(select orders.id from ordering.orderrecord orders
    where orders.total_minor<>(select coalesce(sum(line.payable_minor),0) from ordering.line line where line.order_id=orders.id))
  then raise exception 'IDEAL_ORDER_AMOUNT_MISMATCH'; end if;
  if exists(select 1 from payment.payment where refunded_minor>captured_minor or captured_minor>amount_minor)
  then raise exception 'IDEAL_PAYMENT_AMOUNT_MISMATCH'; end if;
  if exists(select 1 from approval.tasks task left join approval.instances instance on instance.id=task.instance_id where instance.id is null)
    or exists(select 1 from runtime.outbox outbox left join runtime.event event
      on event.type=outbox.event_type and event.version=outbox.event_version where event.type is null)
    or exists(select 1 from runtime.inbox inbox left join runtime.event event
      on event.type=inbox.event_type and event.version=inbox.event_version where event.type is null)
  then raise exception 'IDEAL_BUSINESS_ORPHAN_FOUND'; end if;
end
$assert$;

select runtime.record_migration_evidence('20260904060000',
  (select count(*) from runtime.businessreference),(select count(*) from runtime.businessreference),
  (select coalesce(sum(total_minor),0) from ordering.orderrecord),(select coalesce(sum(total_minor),0) from ordering.orderrecord),
  'select aggregate_type,count(*) from runtime.businessreference group by aggregate_type order by aggregate_type;',
  'select migration,source_rows,target_rows,source_minor,target_minor from runtime.migrationevidence order by migration;');
insert into runtime.schemaversion(version,checksum)
values('20260904060000',encode(public.digest('20260904060000_assert_business_invariants','sha256'),'hex'));

commit;
