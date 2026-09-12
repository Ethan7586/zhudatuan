begin;

-- Critical writes now append one runtime.operation.completed event whose scope
-- is the authenticated owner/member. Preserve the existing mall-scoped event
-- branches and admit only this exact owner-scoped completion event.
drop policy if exists zhudatuanpurchaseapiselect on runtime.outbox;
create policy zhudatuanpurchaseapiselect on runtime.outbox
  for select to zhudatuanpurchaseapi
  using(
    (event_type='order.placed' and aggregate_type='order' and access.purchase_order_allowed(aggregate_id))
    or (
      event_type='runtime.operation.completed'
      and aggregate_type='operation'
      and access.purchase_member_allowed(scope_id)
    )
  );

drop policy if exists zhudatuanpurchaseapiinsert on runtime.outbox;
create policy zhudatuanpurchaseapiinsert on runtime.outbox
  for insert to zhudatuanpurchaseapi
  with check(
    (
      scope_id is not null and access.purchase_mall_allowed(scope_id) and (
        (event_type='checkout.quote.created' and aggregate_type='checkout' and access.purchase_checkout_allowed(aggregate_id))
        or (event_type='checkout.quote.confirmed' and aggregate_type='checkout' and access.purchase_checkout_allowed(aggregate_id))
        or (event_type='inventory.stock.reserved' and aggregate_type='order' and access.purchase_order_allowed(aggregate_id))
        or (event_type='order.placed' and aggregate_type='order' and access.purchase_order_allowed(aggregate_id))
        or (event_type='payment.succeeded' and aggregate_type='payment' and exists(
          select 1 from payment.payment payment
          where payment.id=aggregate_id and access.purchase_intent_allowed(payment.intent_id)
        ))
        or (event_type='order.paid' and aggregate_type='order' and access.purchase_order_allowed(aggregate_id))
      )
    )
    or (
      event_type='runtime.operation.completed'
      and aggregate_type='operation'
      and access.purchase_member_allowed(scope_id)
    )
  );

insert into runtime.schemaversion(version,checksum)
values('20260913021600','06b19c089bb8a2b95f7e9615da6ff8eb1fac86f22454c0be98e1a27e15c19522');

commit;
