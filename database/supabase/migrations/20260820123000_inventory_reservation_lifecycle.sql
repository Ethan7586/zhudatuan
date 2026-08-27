-- Inventory is authoritative here. The legacy public.inventory row is imported as
-- unresolved history; it is deliberately not treated as a valid reservation ledger.
create schema if not exists inventory;

revoke all on schema inventory from public, anon, authenticated;
grant usage on schema inventory to service_role;

create unique index if not exists malls_inventory_scope_unique
on public.malls (tenant_id, id);
create unique index if not exists skus_inventory_scope_unique
on public.skus (tenant_id, mall_id, id);
create unique index if not exists orders_inventory_scope_unique
on public.orders (tenant_id, mall_id, id);

create or replace function inventory.new_id()
returns text language sql volatile set search_path = inventory, public, pg_temp as $$
  select lpad(floor(extract(epoch from clock_timestamp())*1000)::bigint::text,13,'0')
    || '-' || replace(gen_random_uuid()::text,'-','');
$$;

create table inventory.stock_items (
  id text primary key default inventory.new_id(),
  tenant_id text not null references public.tenants(id),
  mall_id text not null,
  sku_id text not null,
  location_id text not null default 'default' check (char_length(trim(location_id)) between 1 and 120),
  onhand integer not null check (onhand >= 0),
  safety integer not null default 0 check (safety >= 0 and safety <= onhand),
  version bigint not null default 0 check (version >= 0),
  cutover_status text not null default 'ready' check (cutover_status in ('ready', 'manual_review')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (tenant_id, mall_id) references public.malls(tenant_id, id),
  foreign key (tenant_id, mall_id, sku_id) references public.skus(tenant_id, mall_id, id),
  unique (tenant_id, mall_id, sku_id, location_id),
  unique (tenant_id, mall_id, id),
  unique (tenant_id, mall_id, id, sku_id, location_id)
);

create table inventory.commands (
  id text primary key default inventory.new_id(),
  tenant_id text not null references public.tenants(id),
  mall_id text not null,
  operation text not null check (operation in ('reserve', 'commit', 'release', 'expire', 'restock')),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 160),
  request_json jsonb not null check (jsonb_typeof(request_json) = 'object'),
  response_json jsonb,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  foreign key (tenant_id, mall_id) references public.malls(tenant_id, id),
  unique (tenant_id, mall_id, operation, idempotency_key),
  unique (tenant_id, mall_id, id),
  check ((response_json is null and completed_at is null) or (response_json is not null and completed_at is not null))
);

create table inventory.reservations (
  id text primary key default inventory.new_id(),
  tenant_id text not null,
  mall_id text not null,
  order_id text not null,
  stock_item_id text not null,
  sku_id text not null,
  location_id text not null,
  quantity integer not null check (quantity > 0),
  state text not null default 'active' check (state in ('active', 'committed', 'released', 'expired')),
  expires_at timestamptz not null,
  committed_at timestamptz,
  released_at timestamptz,
  expired_at timestamptz,
  release_reason text,
  version bigint not null default 0 check (version >= 0),
  created_by_command_id text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (tenant_id, mall_id, stock_item_id, sku_id, location_id)
    references inventory.stock_items(tenant_id, mall_id, id, sku_id, location_id),
  foreign key (tenant_id, mall_id, order_id)
    references public.orders(tenant_id, mall_id, id) deferrable initially deferred,
  foreign key (tenant_id, mall_id, sku_id)
    references public.skus(tenant_id, mall_id, id),
  foreign key (tenant_id, mall_id, created_by_command_id)
    references inventory.commands(tenant_id, mall_id, id),
  unique (tenant_id, mall_id, order_id, sku_id, location_id),
  unique (tenant_id, mall_id, id, stock_item_id, sku_id, location_id, order_id),
  check (
    (state = 'active' and committed_at is null and released_at is null and expired_at is null and release_reason is null)
    or (state = 'committed' and committed_at is not null and released_at is null and expired_at is null and release_reason is null)
    or (state = 'released' and committed_at is null and released_at is not null and expired_at is null and release_reason is not null)
    or (state = 'expired' and committed_at is null and released_at is null and expired_at is not null and release_reason is null)
  )
);

create table inventory.movements (
  id text primary key default inventory.new_id(),
  tenant_id text not null,
  mall_id text not null,
  stock_item_id text not null,
  reservation_id text,
  order_id text not null,
  sku_id text not null,
  location_id text not null,
  kind text not null check (kind in ('reserve', 'sale', 'release', 'expire', 'restock')),
  quantity integer not null check (quantity > 0),
  business_reference text not null check (char_length(trim(business_reference)) between 1 and 200),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 160),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  occurred_at timestamptz not null default clock_timestamp(),
  foreign key (tenant_id, mall_id, stock_item_id, sku_id, location_id)
    references inventory.stock_items(tenant_id, mall_id, id, sku_id, location_id),
  foreign key (tenant_id, mall_id, order_id)
    references public.orders(tenant_id, mall_id, id) deferrable initially deferred,
  foreign key (tenant_id, mall_id, sku_id)
    references public.skus(tenant_id, mall_id, id),
  foreign key (tenant_id, mall_id, reservation_id, stock_item_id, sku_id, location_id, order_id)
    references inventory.reservations(
      tenant_id, mall_id, id, stock_item_id, sku_id, location_id, order_id
    ),
  unique (tenant_id, mall_id, kind, idempotency_key, stock_item_id),
  unique (tenant_id, mall_id, kind, business_reference, stock_item_id)
);

create table inventory.observations (
  id text primary key default inventory.new_id(),
  tenant_id text not null,
  mall_id text not null,
  stock_item_id text not null,
  sku_id text not null,
  location_id text not null,
  observation_kind text not null check (observation_kind in ('stock_snapshot', 'return_inspection')),
  source_kind text not null check (char_length(trim(source_kind)) between 1 and 80),
  source_reference text not null check (char_length(trim(source_reference)) between 1 and 200),
  observed_onhand integer check (observed_onhand is null or observed_onhand >= 0),
  observed_quantity integer check (observed_quantity is null or observed_quantity > 0),
  disposition text not null check (disposition in ('pending', 'accepted', 'rejected')),
  payload_json jsonb not null default '{}'::jsonb check (jsonb_typeof(payload_json) = 'object'),
  observed_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  foreign key (tenant_id, mall_id, stock_item_id, sku_id, location_id)
    references inventory.stock_items(tenant_id, mall_id, id, sku_id, location_id),
  foreign key (tenant_id, mall_id, sku_id)
    references public.skus(tenant_id, mall_id, id),
  unique (tenant_id, mall_id, observation_kind, source_kind, source_reference, stock_item_id),
  check (
    (observation_kind = 'stock_snapshot' and observed_onhand is not null and observed_quantity is null)
    or (observation_kind = 'return_inspection' and observed_onhand is null and observed_quantity is not null)
  )
);

create table inventory.sync_states (
  tenant_id text not null references public.tenants(id),
  mall_id text not null,
  source_kind text not null,
  source_reference text not null,
  location_id text not null,
  cursor_value text,
  state text not null check (state in ('queued', 'running', 'completed', 'partial', 'failed', 'dead')),
  observed_count bigint not null default 0 check (observed_count >= 0),
  applied_count bigint not null default 0 check (applied_count >= 0 and applied_count <= observed_count),
  failed_count bigint not null default 0 check (failed_count >= 0 and failed_count <= observed_count),
  last_error text,
  version bigint not null default 0 check (version >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (tenant_id, mall_id) references public.malls(tenant_id, id),
  primary key (tenant_id, mall_id, source_kind, source_reference, location_id),
  check ((state in ('completed', 'partial', 'failed', 'dead')) = (completed_at is not null)),
  check (state <> 'running' or started_at is not null),
  check (applied_count + failed_count <= observed_count),
  check (state <> 'completed' or (applied_count = observed_count and failed_count = 0))
);

create table inventory.cutover_records (
  id text primary key default inventory.new_id(),
  tenant_id text not null,
  mall_id text not null,
  stock_item_id text not null,
  source_relation text not null,
  legacy_available integer not null check (legacy_available >= 0),
  legacy_reserved integer not null check (legacy_reserved >= 0),
  status text not null check (status = 'manual_review'),
  reason text not null,
  captured_at timestamptz not null default clock_timestamp(),
  foreign key (tenant_id, mall_id, stock_item_id)
    references inventory.stock_items(tenant_id, mall_id, id),
  unique (tenant_id, mall_id, stock_item_id, source_relation)
);

create index inventory_reservations_active_stock
on inventory.reservations (tenant_id, mall_id, stock_item_id, expires_at)
where state = 'active';
create index inventory_reservations_due
on inventory.reservations (expires_at, tenant_id, mall_id, order_id)
where state = 'active';
create index inventory_reservations_order
on inventory.reservations (tenant_id, mall_id, order_id, sku_id, location_id);
create index inventory_movements_reference
on inventory.movements (tenant_id, mall_id, order_id, sku_id, occurred_at);
create index inventory_observations_inspection
on inventory.observations (tenant_id, mall_id, source_reference, sku_id)
where observation_kind = 'return_inspection' and disposition = 'accepted';
create index inventory_sync_states_work
on inventory.sync_states (state, updated_at);

create or replace function inventory.enforce_stock_item_update()
returns trigger language plpgsql set search_path = inventory, public, pg_temp as $$
begin
  if row(new.id,new.tenant_id,new.mall_id,new.sku_id,new.location_id,new.created_at)
       is distinct from row(old.id,old.tenant_id,old.mall_id,old.sku_id,old.location_id,old.created_at)
     or new.version <> old.version + 1
     or (old.cutover_status = 'ready' and new.cutover_status <> 'ready')
  then raise exception 'INVENTORY_STOCK_IDENTITY_OR_VERSION_INVALID'; end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function inventory.enforce_reservation_transition()
returns trigger language plpgsql set search_path = inventory, public, pg_temp as $$
begin
  if row(new.id,new.tenant_id,new.mall_id,new.order_id,new.stock_item_id,new.sku_id,
         new.location_id,new.quantity,new.expires_at,new.created_by_command_id,new.created_at)
       is distinct from
       row(old.id,old.tenant_id,old.mall_id,old.order_id,old.stock_item_id,old.sku_id,
         old.location_id,old.quantity,old.expires_at,old.created_by_command_id,old.created_at)
     or old.state <> 'active'
     or new.state not in ('committed', 'released', 'expired')
     or new.version <> old.version + 1
  then raise exception 'INVENTORY_RESERVATION_TRANSITION_INVALID'; end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function inventory.enforce_sync_state_update()
returns trigger language plpgsql set search_path = inventory, public, pg_temp as $$
begin
  if row(new.tenant_id,new.mall_id,new.source_kind,new.source_reference,new.location_id)
       is distinct from
       row(old.tenant_id,old.mall_id,old.source_kind,old.source_reference,old.location_id)
     or new.version <> old.version + 1
  then raise exception 'INVENTORY_SYNC_STATE_VERSION_INVALID'; end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger inventory_stock_item_update_guard
before update on inventory.stock_items for each row
execute function inventory.enforce_stock_item_update();
create trigger inventory_reservation_transition_guard
before update on inventory.reservations for each row
execute function inventory.enforce_reservation_transition();
create trigger inventory_sync_state_update_guard
before update on inventory.sync_states for each row
execute function inventory.enforce_sync_state_update();
create trigger inventory_movements_immutable
before update or delete on inventory.movements for each row
execute function public.reject_immutable_change();
create trigger inventory_observations_immutable
before update or delete on inventory.observations for each row
execute function public.reject_immutable_change();
create trigger inventory_cutover_records_immutable
before update or delete on inventory.cutover_records for each row
execute function public.reject_immutable_change();

create or replace function inventory.canonical_items(p_items jsonb)
returns jsonb language plpgsql immutable set search_path = inventory, public, pg_temp as $$
declare v_items jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100
     or exists (
       select 1 from jsonb_array_elements(p_items) entry
       where jsonb_typeof(entry) is distinct from 'object'
          or jsonb_typeof(entry->'skuId') is distinct from 'string'
          or char_length(trim(entry->>'skuId')) not between 1 and 160
          or (entry ? 'locationId' and jsonb_typeof(entry->'locationId') is distinct from 'string')
          or char_length(trim(coalesce(entry->>'locationId', 'default'))) not between 1 and 120
          or jsonb_typeof(entry->'quantity') is distinct from 'number'
          or entry->>'quantity' !~ '^[1-9][0-9]{0,6}$'
          or (entry->>'quantity')::integer > 1000000
     )
  then raise exception 'INVENTORY_ITEMS_INVALID'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) entry
    group by trim(entry->>'skuId'), trim(coalesce(entry->>'locationId', 'default'))
    having count(*) > 1
  ) then raise exception 'INVENTORY_ITEMS_DUPLICATED'; end if;
  select jsonb_agg(jsonb_build_object(
    'skuId', trim(entry->>'skuId'),
    'locationId', trim(coalesce(entry->>'locationId', 'default')),
    'quantity', (entry->>'quantity')::integer
  ) order by trim(entry->>'skuId'), trim(coalesce(entry->>'locationId', 'default')))
  into v_items from jsonb_array_elements(p_items) entry;
  return v_items;
end;
$$;

create or replace function inventory.begin_command(
  p_operation text, p_tenant_id text, p_mall_id text,
  p_idempotency_key text, p_request_json jsonb
) returns inventory.commands
language plpgsql security definer set search_path = inventory, public, pg_temp as $$
declare v_command inventory.commands%rowtype;
begin
  if p_operation not in ('reserve','commit','release','expire','restock')
     or char_length(trim(coalesce(p_idempotency_key,''))) not between 1 and 160
     or jsonb_typeof(p_request_json) <> 'object'
  then raise exception 'INVENTORY_COMMAND_INVALID'; end if;
  insert into inventory.commands (tenant_id,mall_id,operation,idempotency_key,request_json)
  values (p_tenant_id,p_mall_id,p_operation,trim(p_idempotency_key),p_request_json)
  on conflict (tenant_id,mall_id,operation,idempotency_key) do nothing;
  select * into strict v_command from inventory.commands command
  where command.tenant_id=p_tenant_id and command.mall_id=p_mall_id
    and command.operation=p_operation and command.idempotency_key=trim(p_idempotency_key)
  for update;
  if v_command.request_json is distinct from p_request_json
  then raise exception 'INVENTORY_IDEMPOTENCY_CONFLICT'; end if;
  return v_command;
end;
$$;

create or replace function inventory.finish_command(p_command_id text, p_response jsonb)
returns jsonb language plpgsql security definer set search_path = inventory, public, pg_temp as $$
begin
  update inventory.commands set response_json=p_response,completed_at=clock_timestamp()
  where id=p_command_id and response_json is null;
  if not found then raise exception 'INVENTORY_COMMAND_COMPLETION_INVALID'; end if;
  return p_response;
end;
$$;

create or replace function inventory.order_reservations_response(p_order_id text)
returns jsonb language sql stable security definer set search_path = inventory, public, pg_temp as $$
  select jsonb_build_object(
    'orderId', p_order_id,
    'reservations', coalesce(jsonb_agg(jsonb_build_object(
      'id',reservation.id,'skuId',reservation.sku_id,'locationId',reservation.location_id,
      'quantity',reservation.quantity,'state',reservation.state,'expiresAt',reservation.expires_at,
      'version',reservation.version
    ) order by reservation.sku_id,reservation.location_id), '[]'::jsonb)
  ) from inventory.reservations reservation where reservation.order_id=p_order_id;
$$;

create or replace function inventory.reserve(
  p_tenant_id text, p_mall_id text, p_order_id text, p_items jsonb,
  p_idempotency_key text, p_expires_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = inventory, public, pg_temp as $$
declare
  v_items jsonb; v_request jsonb; v_command inventory.commands%rowtype;
  v_entry jsonb; v_stock inventory.stock_items%rowtype; v_order public.orders%rowtype;
  v_reserved bigint; v_reservation_id text; v_response jsonb;
begin
  v_items:=inventory.canonical_items(p_items);
  if p_expires_at is null or p_expires_at <= clock_timestamp()
     or p_expires_at > clock_timestamp()+interval '24 hours'
     or char_length(trim(coalesce(p_order_id,''))) not between 1 and 160
  then raise exception 'INVENTORY_RESERVATION_INPUT_INVALID'; end if;
  v_request:=jsonb_build_object('orderId',p_order_id,'items',v_items,'expiresAt',p_expires_at);
  select * into v_command from inventory.begin_command(
    'reserve',p_tenant_id,p_mall_id,p_idempotency_key,v_request
  );
  if v_command.response_json is not null then return v_command.response_json; end if;
  select * into v_order from public.orders orders where orders.id=p_order_id for update;
  if found and (v_order.tenant_id<>p_tenant_id or v_order.mall_id<>p_mall_id or v_order.status<>'pending_payment')
  then raise exception 'INVENTORY_ORDER_NOT_RESERVABLE'; end if;
  perform stock.id from inventory.stock_items stock
  join jsonb_array_elements(v_items) entry
    on stock.sku_id=entry->>'skuId' and stock.location_id=entry->>'locationId'
  where stock.tenant_id=p_tenant_id and stock.mall_id=p_mall_id
  order by stock.sku_id,stock.location_id,stock.id for update of stock;
  if (select count(*) from inventory.stock_items stock
      join jsonb_array_elements(v_items) entry
        on stock.sku_id=entry->>'skuId' and stock.location_id=entry->>'locationId'
      where stock.tenant_id=p_tenant_id and stock.mall_id=p_mall_id) <> jsonb_array_length(v_items)
  then raise exception 'INVENTORY_STOCK_NOT_FOUND'; end if;
  for v_entry in select value from jsonb_array_elements(v_items) loop
    select * into strict v_stock from inventory.stock_items stock
    where stock.tenant_id=p_tenant_id and stock.mall_id=p_mall_id
      and stock.sku_id=v_entry->>'skuId' and stock.location_id=v_entry->>'locationId';
    if v_stock.cutover_status<>'ready' then raise exception 'INVENTORY_HISTORY_REQUIRES_REVIEW'; end if;
    select coalesce(sum(reservation.quantity),0) into v_reserved
    from inventory.reservations reservation
    where reservation.stock_item_id=v_stock.id and reservation.state='active';
    if v_stock.onhand-v_stock.safety-v_reserved < (v_entry->>'quantity')::integer
    then raise exception 'INSUFFICIENT_INVENTORY'; end if;
    begin
      v_reservation_id:=inventory.new_id();
      insert into inventory.reservations (
        id,tenant_id,mall_id,order_id,stock_item_id,sku_id,location_id,quantity,
        expires_at,created_by_command_id
      ) values (
        v_reservation_id,p_tenant_id,p_mall_id,p_order_id,v_stock.id,v_stock.sku_id,
        v_stock.location_id,(v_entry->>'quantity')::integer,p_expires_at,v_command.id
      );
    exception when unique_violation then
      raise exception 'INVENTORY_RESERVATION_ALREADY_EXISTS';
    end;
    update inventory.stock_items set version=version+1 where id=v_stock.id;
    insert into inventory.movements (
      tenant_id,mall_id,stock_item_id,reservation_id,order_id,sku_id,location_id,
      kind,quantity,business_reference,idempotency_key
    ) values (
      p_tenant_id,p_mall_id,v_stock.id,v_reservation_id,p_order_id,v_stock.sku_id,
      v_stock.location_id,'reserve',(v_entry->>'quantity')::integer,p_order_id,p_idempotency_key
    );
  end loop;
  v_response:=inventory.order_reservations_response(p_order_id);
  return inventory.finish_command(v_command.id,v_response);
end;
$$;

create or replace function inventory.commit(
  p_tenant_id text, p_mall_id text, p_order_id text, p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = inventory, public, pg_temp as $$
declare
  v_command inventory.commands%rowtype; v_order public.orders%rowtype;
  v_reservation inventory.reservations%rowtype; v_stock inventory.stock_items%rowtype;
  v_other_reserved bigint; v_response jsonb;
begin
  select * into v_command from inventory.begin_command(
    'commit',p_tenant_id,p_mall_id,p_idempotency_key,jsonb_build_object('orderId',p_order_id)
  );
  if v_command.response_json is not null then return v_command.response_json; end if;
  select * into v_order from public.orders orders where orders.id=p_order_id for update;
  if not found or v_order.tenant_id<>p_tenant_id or v_order.mall_id<>p_mall_id
  then raise exception 'INVENTORY_ORDER_NOT_FOUND'; end if;
  perform stock.id from inventory.stock_items stock join inventory.reservations reservation
    on reservation.stock_item_id=stock.id
  where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id and reservation.order_id=p_order_id
  order by stock.sku_id,stock.location_id,stock.id for update of stock;
  perform reservation.id from inventory.reservations reservation
  where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id and reservation.order_id=p_order_id
  order by reservation.sku_id,reservation.location_id,reservation.id for update;
  if not exists(select 1 from inventory.reservations where tenant_id=p_tenant_id and mall_id=p_mall_id and order_id=p_order_id)
     or exists(select 1 from inventory.reservations where tenant_id=p_tenant_id and mall_id=p_mall_id
       and order_id=p_order_id and state not in ('active','committed'))
  then raise exception 'INVENTORY_COMMIT_TRANSITION_INVALID'; end if;
  if exists(select 1 from inventory.reservations where tenant_id=p_tenant_id and mall_id=p_mall_id
       and order_id=p_order_id and state='active') and v_order.status<>'paid'
  then raise exception 'INVENTORY_PAYMENT_REQUIRED'; end if;
  for v_reservation in select * from inventory.reservations reservation
    where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id
      and reservation.order_id=p_order_id and reservation.state='active'
    order by reservation.sku_id,reservation.location_id,reservation.id
  loop
    select * into strict v_stock from inventory.stock_items where id=v_reservation.stock_item_id;
    select coalesce(sum(quantity),0) into v_other_reserved from inventory.reservations
    where stock_item_id=v_stock.id and state='active' and order_id<>p_order_id;
    if v_stock.onhand-v_reservation.quantity-v_stock.safety-v_other_reserved < 0
    then raise exception 'INVENTORY_COMMIT_STOCK_CONFLICT'; end if;
    update inventory.stock_items set onhand=onhand-v_reservation.quantity,version=version+1
    where id=v_stock.id;
    update inventory.reservations set state='committed',committed_at=clock_timestamp(),version=version+1
    where id=v_reservation.id;
    insert into inventory.movements (
      tenant_id,mall_id,stock_item_id,reservation_id,order_id,sku_id,location_id,
      kind,quantity,business_reference,idempotency_key
    ) values (
      p_tenant_id,p_mall_id,v_stock.id,v_reservation.id,p_order_id,v_reservation.sku_id,
      v_reservation.location_id,'sale',v_reservation.quantity,p_order_id,p_idempotency_key
    );
  end loop;
  v_response:=inventory.order_reservations_response(p_order_id);
  return inventory.finish_command(v_command.id,v_response);
end;
$$;

create or replace function inventory.release(
  p_tenant_id text, p_mall_id text, p_order_id text,
  p_reason text, p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = inventory, public, pg_temp as $$
declare
  v_command inventory.commands%rowtype; v_order public.orders%rowtype;
  v_reservation inventory.reservations%rowtype; v_response jsonb;
begin
  if p_reason not in ('cancelled','payment_failed') then raise exception 'INVENTORY_RELEASE_REASON_INVALID'; end if;
  select * into v_command from inventory.begin_command(
    'release',p_tenant_id,p_mall_id,p_idempotency_key,
    jsonb_build_object('orderId',p_order_id,'reason',p_reason)
  );
  if v_command.response_json is not null then return v_command.response_json; end if;
  select * into v_order from public.orders orders where orders.id=p_order_id for update;
  if not found or v_order.tenant_id<>p_tenant_id or v_order.mall_id<>p_mall_id
  then raise exception 'INVENTORY_ORDER_NOT_FOUND'; end if;
  perform stock.id from inventory.stock_items stock join inventory.reservations reservation
    on reservation.stock_item_id=stock.id
  where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id and reservation.order_id=p_order_id
  order by stock.sku_id,stock.location_id,stock.id for update of stock;
  perform reservation.id from inventory.reservations reservation
  where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id and reservation.order_id=p_order_id
  order by reservation.sku_id,reservation.location_id,reservation.id for update;
  if not exists(select 1 from inventory.reservations where tenant_id=p_tenant_id and mall_id=p_mall_id and order_id=p_order_id)
     or exists(select 1 from inventory.reservations where tenant_id=p_tenant_id and mall_id=p_mall_id
       and order_id=p_order_id and state not in ('active','released'))
  then raise exception 'INVENTORY_RELEASE_TRANSITION_INVALID'; end if;
  if exists(select 1 from inventory.reservations where tenant_id=p_tenant_id and mall_id=p_mall_id
       and order_id=p_order_id and state='active')
     and ((p_reason='cancelled' and v_order.status<>'cancelled')
       or (p_reason='payment_failed' and v_order.status not in ('pending_payment','cancelled')))
  then raise exception 'INVENTORY_ORDER_NOT_RELEASABLE'; end if;
  for v_reservation in select * from inventory.reservations reservation
    where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id
      and reservation.order_id=p_order_id and reservation.state='active'
    order by reservation.sku_id,reservation.location_id,reservation.id
  loop
    update inventory.stock_items set version=version+1 where id=v_reservation.stock_item_id;
    update inventory.reservations set state='released',released_at=clock_timestamp(),
      release_reason=p_reason,version=version+1 where id=v_reservation.id;
    insert into inventory.movements (
      tenant_id,mall_id,stock_item_id,reservation_id,order_id,sku_id,location_id,
      kind,quantity,business_reference,idempotency_key,metadata_json
    ) values (
      p_tenant_id,p_mall_id,v_reservation.stock_item_id,v_reservation.id,p_order_id,
      v_reservation.sku_id,v_reservation.location_id,'release',v_reservation.quantity,
      p_order_id,p_idempotency_key,jsonb_build_object('reason',p_reason)
    );
  end loop;
  v_response:=inventory.order_reservations_response(p_order_id);
  return inventory.finish_command(v_command.id,v_response);
end;
$$;

create or replace function inventory.expire(
  p_tenant_id text, p_mall_id text, p_order_id text, p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = inventory, public, pg_temp as $$
declare
  v_command inventory.commands%rowtype; v_order public.orders%rowtype;
  v_reservation inventory.reservations%rowtype; v_response jsonb;
begin
  select * into v_command from inventory.begin_command(
    'expire',p_tenant_id,p_mall_id,p_idempotency_key,jsonb_build_object('orderId',p_order_id)
  );
  if v_command.response_json is not null then return v_command.response_json; end if;
  select * into v_order from public.orders orders where orders.id=p_order_id for update;
  if not found or v_order.tenant_id<>p_tenant_id or v_order.mall_id<>p_mall_id
  then raise exception 'INVENTORY_ORDER_NOT_FOUND'; end if;
  perform stock.id from inventory.stock_items stock join inventory.reservations reservation
    on reservation.stock_item_id=stock.id
  where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id and reservation.order_id=p_order_id
  order by stock.sku_id,stock.location_id,stock.id for update of stock;
  perform reservation.id from inventory.reservations reservation
  where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id and reservation.order_id=p_order_id
  order by reservation.sku_id,reservation.location_id,reservation.id for update;
  if not exists(select 1 from inventory.reservations where tenant_id=p_tenant_id and mall_id=p_mall_id and order_id=p_order_id)
     or exists(select 1 from inventory.reservations where tenant_id=p_tenant_id and mall_id=p_mall_id
       and order_id=p_order_id and state not in ('active','expired'))
  then raise exception 'INVENTORY_EXPIRE_TRANSITION_INVALID'; end if;
  if exists(select 1 from inventory.reservations where tenant_id=p_tenant_id and mall_id=p_mall_id
       and order_id=p_order_id and state='active' and expires_at>clock_timestamp())
  then raise exception 'INVENTORY_RESERVATION_NOT_EXPIRED'; end if;
  if exists(select 1 from inventory.reservations where tenant_id=p_tenant_id and mall_id=p_mall_id
       and order_id=p_order_id and state='active') and v_order.status<>'pending_payment'
  then raise exception 'INVENTORY_ORDER_NOT_EXPIRABLE'; end if;
  for v_reservation in select * from inventory.reservations reservation
    where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id
      and reservation.order_id=p_order_id and reservation.state='active'
    order by reservation.sku_id,reservation.location_id,reservation.id
  loop
    update inventory.stock_items set version=version+1 where id=v_reservation.stock_item_id;
    update inventory.reservations set state='expired',expired_at=clock_timestamp(),version=version+1
    where id=v_reservation.id;
    insert into inventory.movements (
      tenant_id,mall_id,stock_item_id,reservation_id,order_id,sku_id,location_id,
      kind,quantity,business_reference,idempotency_key
    ) values (
      p_tenant_id,p_mall_id,v_reservation.stock_item_id,v_reservation.id,p_order_id,
      v_reservation.sku_id,v_reservation.location_id,'expire',v_reservation.quantity,
      p_order_id,p_idempotency_key
    );
  end loop;
  v_response:=inventory.order_reservations_response(p_order_id);
  return inventory.finish_command(v_command.id,v_response);
end;
$$;

create or replace function inventory.restock(
  p_tenant_id text, p_mall_id text, p_order_id text, p_after_sale_id text,
  p_inspection_reference text, p_items jsonb, p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = inventory, public, pg_temp as $$
declare
  v_items jsonb; v_request jsonb; v_command inventory.commands%rowtype;
  v_order public.orders%rowtype; v_after_sale public.after_sales%rowtype;
  v_entry jsonb; v_stock inventory.stock_items%rowtype; v_inspected bigint;
  v_ordered bigint; v_restocked bigint; v_existing_count integer; v_response jsonb;
begin
  v_items:=inventory.canonical_items(p_items);
  if char_length(trim(coalesce(p_inspection_reference,''))) not between 1 and 200
  then raise exception 'INVENTORY_INSPECTION_REFERENCE_INVALID'; end if;
  v_request:=jsonb_build_object('orderId',p_order_id,'afterSaleId',p_after_sale_id,
    'inspectionReference',trim(p_inspection_reference),'items',v_items);
  select * into v_command from inventory.begin_command(
    'restock',p_tenant_id,p_mall_id,p_idempotency_key,v_request
  );
  if v_command.response_json is not null then return v_command.response_json; end if;
  select * into v_order from public.orders orders where orders.id=p_order_id for update;
  select * into v_after_sale from public.after_sales after_sale where after_sale.id=p_after_sale_id for update;
  if v_order.id is null or v_after_sale.id is null or v_order.tenant_id<>p_tenant_id
     or v_order.mall_id<>p_mall_id or v_after_sale.tenant_id<>p_tenant_id
     or v_after_sale.mall_id<>p_mall_id or v_after_sale.order_id<>p_order_id
     or v_after_sale.type not in ('return_refund','exchange') or v_after_sale.status<>'completed'
  then raise exception 'INVENTORY_RESTOCK_NOT_AUTHORIZED'; end if;
  perform stock.id from inventory.stock_items stock
  join jsonb_array_elements(v_items) entry
    on stock.sku_id=entry->>'skuId' and stock.location_id=entry->>'locationId'
  where stock.tenant_id=p_tenant_id and stock.mall_id=p_mall_id
  order by stock.sku_id,stock.location_id,stock.id for update of stock;
  if (select count(*) from inventory.stock_items stock
      join jsonb_array_elements(v_items) entry
        on stock.sku_id=entry->>'skuId' and stock.location_id=entry->>'locationId'
      where stock.tenant_id=p_tenant_id and stock.mall_id=p_mall_id) <> jsonb_array_length(v_items)
  then raise exception 'INVENTORY_STOCK_NOT_FOUND'; end if;
  select count(*) into v_existing_count from inventory.movements movement
  where movement.tenant_id=p_tenant_id and movement.mall_id=p_mall_id
    and movement.kind='restock' and movement.business_reference=trim(p_inspection_reference);
  if v_existing_count>0 then
    if v_existing_count<>jsonb_array_length(v_items) or exists(
      select 1 from jsonb_array_elements(v_items) entry
      left join inventory.movements movement on movement.tenant_id=p_tenant_id
        and movement.mall_id=p_mall_id and movement.kind='restock'
        and movement.business_reference=trim(p_inspection_reference)
        and movement.order_id=p_order_id
        and movement.metadata_json->>'afterSaleId'=p_after_sale_id
        and movement.sku_id=entry->>'skuId' and movement.location_id=entry->>'locationId'
        and movement.quantity=(entry->>'quantity')::integer
      where movement.id is null
    ) then raise exception 'INVENTORY_RESTOCK_REFERENCE_CONFLICT'; end if;
    v_response:=jsonb_build_object('orderId',p_order_id,'afterSaleId',p_after_sale_id,
      'inspectionReference',trim(p_inspection_reference),'items',v_items);
    return inventory.finish_command(v_command.id,v_response);
  end if;
  for v_entry in select value from jsonb_array_elements(v_items) loop
    select * into strict v_stock from inventory.stock_items stock
    where stock.tenant_id=p_tenant_id and stock.mall_id=p_mall_id
      and stock.sku_id=v_entry->>'skuId' and stock.location_id=v_entry->>'locationId';
    if v_stock.cutover_status<>'ready' then raise exception 'INVENTORY_HISTORY_REQUIRES_REVIEW'; end if;
    select coalesce(sum(observation.observed_quantity),0) into v_inspected
    from inventory.observations observation
    where observation.stock_item_id=v_stock.id and observation.observation_kind='return_inspection'
      and observation.source_kind='quality' and observation.disposition='accepted'
      and observation.source_reference=trim(p_inspection_reference)
      and observation.payload_json->>'restockEligible'='true'
      and observation.payload_json->>'itemKind'='physical'
      and observation.payload_json->>'orderId'=p_order_id
      and observation.payload_json->>'afterSaleId'=p_after_sale_id;
    if v_inspected < (v_entry->>'quantity')::integer
    then raise exception 'INVENTORY_RESTOCK_INSPECTION_REQUIRED'; end if;
    select coalesce(sum(item.quantity),0) into v_ordered from public.order_items item
    where item.order_id=p_order_id and item.sku_id=v_stock.sku_id;
    select coalesce(sum(movement.quantity),0) into v_restocked from inventory.movements movement
    where movement.tenant_id=p_tenant_id and movement.mall_id=p_mall_id
      and movement.order_id=p_order_id and movement.sku_id=v_stock.sku_id and movement.kind='restock';
    if v_ordered=0 or v_restocked+(v_entry->>'quantity')::integer>v_ordered
    then raise exception 'INVENTORY_RESTOCK_QUANTITY_INVALID'; end if;
    update inventory.stock_items set onhand=onhand+(v_entry->>'quantity')::integer,version=version+1
    where id=v_stock.id;
    insert into inventory.movements (
      tenant_id,mall_id,stock_item_id,order_id,sku_id,location_id,kind,quantity,
      business_reference,idempotency_key,metadata_json
    ) values (
      p_tenant_id,p_mall_id,v_stock.id,p_order_id,v_stock.sku_id,v_stock.location_id,
      'restock',(v_entry->>'quantity')::integer,trim(p_inspection_reference),p_idempotency_key,
      jsonb_build_object('afterSaleId',p_after_sale_id)
    );
  end loop;
  v_response:=jsonb_build_object('orderId',p_order_id,'afterSaleId',p_after_sale_id,
    'inspectionReference',trim(p_inspection_reference),'items',v_items);
  return inventory.finish_command(v_command.id,v_response);
end;
$$;

-- The legacy aggregate cannot prove which orders own reserved_qty. Importing it as
-- ready would silently bless missing history, so every row starts fail-closed.
insert into inventory.stock_items (
  tenant_id,mall_id,sku_id,location_id,onhand,safety,version,cutover_status,created_at,updated_at
)
select legacy.tenant_id,legacy.mall_id,legacy.sku_id,'default',legacy.available_qty,0,
  greatest(legacy.version,0),'manual_review',clock_timestamp(),clock_timestamp()
from public.inventory legacy
on conflict (tenant_id,mall_id,sku_id,location_id) do nothing;

insert into inventory.cutover_records (
  tenant_id,mall_id,stock_item_id,source_relation,legacy_available,legacy_reserved,status,reason
)
select stock.tenant_id,stock.mall_id,stock.id,'public.inventory',legacy.available_qty,
  legacy.reserved_qty,'manual_review',
  case when legacy.reserved_qty>0 then 'reservation_ownership_missing'
       else 'historical_reservation_lineage_missing' end
from public.inventory legacy join inventory.stock_items stock
  on stock.tenant_id=legacy.tenant_id and stock.mall_id=legacy.mall_id
 and stock.sku_id=legacy.sku_id and stock.location_id='default'
on conflict (tenant_id,mall_id,stock_item_id,source_relation) do nothing;

do $$
declare relation_name text;
begin
  foreach relation_name in array array[
    'stock_items','commands','reservations','movements','observations','sync_states','cutover_records'
  ] loop
    execute format('alter table inventory.%I enable row level security',relation_name);
    execute format('revoke all on table inventory.%I from public,anon,authenticated,service_role',relation_name);
  end loop;
end;
$$;

revoke all on function inventory.new_id() from public,anon,authenticated,service_role;
revoke all on function inventory.enforce_stock_item_update() from public,anon,authenticated,service_role;
revoke all on function inventory.enforce_reservation_transition() from public,anon,authenticated,service_role;
revoke all on function inventory.enforce_sync_state_update() from public,anon,authenticated,service_role;
revoke all on function inventory.canonical_items(jsonb) from public,anon,authenticated,service_role;
revoke all on function inventory.begin_command(text,text,text,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function inventory.finish_command(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function inventory.order_reservations_response(text) from public,anon,authenticated,service_role;
revoke all on function inventory.reserve(text,text,text,jsonb,text,timestamptz) from public,anon,authenticated,service_role;
revoke all on function inventory.commit(text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function inventory.release(text,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function inventory.expire(text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function inventory.restock(text,text,text,text,text,jsonb,text) from public,anon,authenticated,service_role;

grant execute on function inventory.reserve(text,text,text,jsonb,text,timestamptz) to service_role;
grant execute on function inventory.commit(text,text,text,text) to service_role;
grant execute on function inventory.release(text,text,text,text,text) to service_role;
grant execute on function inventory.expire(text,text,text,text) to service_role;
grant execute on function inventory.restock(text,text,text,text,text,jsonb,text) to service_role;
