begin;

do $contract$
declare violation text;
begin
  select namespace.nspname||'.'||relation.relname||'.'||constraintinfo.conname into violation
  from pg_constraint constraintinfo
  join pg_class relation on relation.oid=constraintinfo.conrelid
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  where constraintinfo.contype='f' and not constraintinfo.convalidated
    and namespace.nspname in(select schema_name from runtime.moduleauthority union all select 'invoice')
  order by namespace.nspname,relation.relname,constraintinfo.conname limit 1;
  if violation is not null then raise exception 'IDEAL_FOREIGN_KEY_UNVALIDATED:%',violation; end if;

  select intent.id into violation from payment.intent intent
  left join ordering.orderrecord orders on orders.id=intent.order_id
  where orders.id is null order by intent.id limit 1;
  if violation is not null then raise exception 'IDEAL_PAYMENT_ORDER_ORPHAN:%',violation; end if;

  select reference.aggregate_type||':'||reference.internal_id into violation
  from runtime.businessreference reference
  where case reference.aggregate_type
    when 'catalog.product' then not exists(select 1 from catalog.product value where value.id=reference.internal_id)
    when 'order.order' then not exists(select 1 from ordering.orderrecord value where value.id=reference.internal_id)
    when 'payment.intent' then not exists(select 1 from payment.intent value where value.id=reference.internal_id)
    when 'voucher.voucher' then not exists(select 1 from voucher.voucher value where value.id=reference.internal_id)
    when 'finance.journal' then not exists(select 1 from finance.journal value where value.id=reference.internal_id)
    when 'approval.instance' then not exists(select 1 from approval.instances value where value.id=reference.internal_id)
    when 'partner.customer' then not exists(select 1 from partner.customer value where value.id=reference.internal_id)
    else true end
  order by reference.aggregate_type,reference.internal_id limit 1;
  if violation is not null then raise exception 'IDEAL_BUSINESS_REFERENCE_ORPHAN:%',violation; end if;
end
$contract$;

rollback;
