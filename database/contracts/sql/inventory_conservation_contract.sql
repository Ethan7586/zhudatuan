begin;

do $contract$
declare violation text;
begin
  select stock.id into violation
  from inventory.stockitem stock
  left join inventory.reservation reservation on reservation.stockitem_id=stock.id
    and reservation.state='reserved' and reservation.expires_at>clock_timestamp()
  group by stock.id,stock.onhand,stock.safety
  having stock.onhand-stock.safety-coalesce(sum(reservation.quantity),0)<0
  order by stock.id limit 1;
  if violation is not null then raise exception 'IDEAL_INVENTORY_OVERRESERVED:%',violation; end if;

  select reservation.id into violation
  from inventory.reservation reservation
  left join inventory.stockitem stock on stock.id=reservation.stockitem_id
  where stock.id is null or reservation.quantity<=0 or reservation.expires_at<=reservation.created_at
    or reservation.version<=0
  order by reservation.id limit 1;
  if violation is not null then raise exception 'IDEAL_INVENTORY_RESERVATION_INVALID:%',violation; end if;

  select movement.id into violation
  from inventory.movement movement left join inventory.stockitem stock on stock.id=movement.stockitem_id
  where stock.id is null or movement.quantity_delta=0
  order by movement.id limit 1;
  if violation is not null then raise exception 'IDEAL_INVENTORY_MOVEMENT_INVALID:%',violation; end if;
end
$contract$;

rollback;
