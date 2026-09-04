begin;

do $contract$
declare suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  mall_a text:='mall:inventory-a:'||suffix;
  mall_b text:='mall:inventory-b:'||suffix;
  stock_a text:='stock:a:'||suffix;
  stock_b text:='stock:b:'||suffix;
  reservation_a text:='reservation:a:'||suffix;
  reservation_b text:='reservation:b:'||suffix;
  shared_owner text:='order:shared:'||suffix;
  shared_return text:='return:shared:'||suffix;
begin
  insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
  values(stock_a,mall_a,'sku:shared','location:shared',10,0,0,'active',clock_timestamp()),
    (stock_b,mall_b,'sku:shared','location:shared',10,0,0,'active',clock_timestamp());

  insert into inventory.reservation(id,mall_id,stockitem_id,owner_type,owner_id,quantity,state,expires_at,created_at,version)
  values(reservation_a,mall_a,stock_a,'order',shared_owner,2,'active',clock_timestamp()+interval '30 minutes',clock_timestamp(),0),
    (reservation_b,mall_b,stock_b,'order',shared_owner,3,'active',clock_timestamp()+interval '30 minutes',clock_timestamp(),0);
  insert into inventory.movement(id,mall_id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
  values('movement:reserve:a:'||suffix,mall_a,stock_a,'reserve',-2,'order',shared_owner,clock_timestamp()),
    ('movement:reserve:b:'||suffix,mall_b,stock_b,'reserve',-3,'order',shared_owner,clock_timestamp());

  begin
    insert into inventory.reservation(id,mall_id,stockitem_id,owner_type,owner_id,quantity,state,expires_at,created_at,version)
    values('reservation:mismatch:'||suffix,mall_b,stock_a,'order','order:mismatch:'||suffix,1,'active',
      clock_timestamp()+interval '30 minutes',clock_timestamp(),0);
    raise exception 'INVENTORY_MALL_COMPOSITE_FK_NOT_ENFORCED';
  exception when foreign_key_violation then null;
  end;

  update inventory.reservation set state='committed',version=version+1
    where mall_id=mall_a and owner_type='order' and owner_id=shared_owner and state='active';
  insert into inventory.movement(id,mall_id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
  values('movement:commit:'||suffix,mall_a,stock_a,'commit',-2,'order',shared_owner,clock_timestamp())
  on conflict(mall_id,stockitem_id,kind,reference_type,reference_id) do nothing;
  insert into inventory.movement(id,mall_id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
  values('movement:commit:'||suffix,mall_a,stock_a,'commit',-2,'order',shared_owner,clock_timestamp())
  on conflict(mall_id,stockitem_id,kind,reference_type,reference_id) do nothing;

  update inventory.reservation set state='released',version=version+1
    where mall_id=mall_b and owner_type='order' and owner_id=shared_owner and state='active';
  insert into inventory.movement(id,mall_id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
  values('movement:release:'||suffix,mall_b,stock_b,'release',3,'order',shared_owner,clock_timestamp())
  on conflict(mall_id,stockitem_id,kind,reference_type,reference_id) do nothing;
  insert into inventory.movement(id,mall_id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
  values('movement:release:'||suffix,mall_b,stock_b,'release',3,'order',shared_owner,clock_timestamp())
  on conflict(mall_id,stockitem_id,kind,reference_type,reference_id) do nothing;

  with created as(
    insert into inventory.movement(id,mall_id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
    values('movement:return:'||suffix,mall_a,stock_a,'return',2,'return',shared_return,clock_timestamp())
    on conflict(mall_id,stockitem_id,kind,reference_type,reference_id) do nothing returning stockitem_id,quantity_delta)
  update inventory.stockitem stock set onhand=stock.onhand+created.quantity_delta
    from created where stock.scope_id=mall_a and stock.id=created.stockitem_id;
  with created as(
    insert into inventory.movement(id,mall_id,stockitem_id,kind,quantity_delta,reference_type,reference_id,occurred_at)
    values('movement:return:'||suffix,mall_a,stock_a,'return',2,'return',shared_return,clock_timestamp())
    on conflict(mall_id,stockitem_id,kind,reference_type,reference_id) do nothing returning stockitem_id,quantity_delta)
  update inventory.stockitem stock set onhand=stock.onhand+created.quantity_delta
    from created where stock.scope_id=mall_a and stock.id=created.stockitem_id;

  if (select state from inventory.reservation where mall_id=mall_a and id=reservation_a)<>'committed'
    or (select state from inventory.reservation where mall_id=mall_b and id=reservation_b)<>'released'
  then raise exception 'INVENTORY_MALL_REVERSE_STATE_LEAK'; end if;
  if (select count(*) from inventory.movement where mall_id=mall_a and kind='commit' and reference_id=shared_owner)<>1
    or (select count(*) from inventory.movement where mall_id=mall_b and kind='release' and reference_id=shared_owner)<>1
    or (select count(*) from inventory.movement where mall_id=mall_a and kind='return' and reference_id=shared_return)<>1
  then raise exception 'INVENTORY_MALL_IDEMPOTENCY_FAILED'; end if;
  if (select onhand from inventory.stockitem where scope_id=mall_a and id=stock_a)<>12
  then raise exception 'INVENTORY_MALL_RESTOCK_REPEATED'; end if;
  if (select count(*) from inventory.reservation where mall_id=mall_a and owner_id=shared_owner)<>1
    or (select count(*) from inventory.reservation where mall_id=mall_b and owner_id=shared_owner)<>1
  then raise exception 'INVENTORY_MALL_OWNER_REFERENCE_NOT_SCOPED'; end if;
end $contract$;

rollback;
