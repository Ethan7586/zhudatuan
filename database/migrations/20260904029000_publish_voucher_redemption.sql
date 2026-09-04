begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904028900') then raise exception 'VOUCHER_EVENT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904029000') then raise exception 'VOUCHER_EVENT_ALREADY_APPLIED'; end if;
  -- Drain the old publisher/consumer before cutting over. Historical receipts
  -- and already processed events remain untouched; there is no v1 reader alias.
  if exists(select 1 from runtime.outbox where event_type='voucher.redeemed' and event_version<>2 and published_at is null)
    or exists(select 1 from runtime.inbox where event_type='voucher.redeemed' and event_version<>2 and processed_at is null) then
    raise exception 'VOUCHER_REDEMPTION_EVENT_DRAIN_REQUIRED';
  end if;
end $precondition$;

-- Retired catalog rows remain only as FK-backed historical evidence. They do
-- not count as live contracts and cannot accept new outbox facts.
alter table runtime.event add column retired_at timestamptz;
update runtime.event set retired_at=clock_timestamp() where type='voucher.redeemed' and version=1;
insert into runtime.event(type,version,owner,schema_ref)
values('voucher.redeemed',2,'voucher','contract://events/voucher.redeemed/v2');
create unique index runtime_event_active on runtime.event(type) where retired_at is null;

create function runtime.guard_event_version() returns trigger language plpgsql set search_path=runtime,pg_temp as $function$
begin
  if not exists(select 1 from runtime.event where type=new.event_type and version=new.event_version and retired_at is null) then
    raise exception 'EVENT_VERSION_INACTIVE';
  end if;
  return new;
end $function$;
create trigger activeevent before insert on runtime.outbox for each row execute function runtime.guard_event_version();
create trigger activeevent before insert on runtime.inbox for each row execute function runtime.guard_event_version();
revoke all on function runtime.guard_event_version() from public;

create function runtime.guard_voucher_redemption() returns trigger language plpgsql set search_path=runtime,voucher,pg_temp as $function$
declare redeemed voucher.redemption%rowtype;
begin
  if new.event_type<>'voucher.redeemed' then return new; end if;
  if new.event_version<>2 or new.payload_version<>2 then raise exception 'VOUCHER_REDEMPTION_EVENT_VERSION_INVALID'; end if;
  select * into redeemed from voucher.redemption where id=new.payload->>'redemption' and scope_id=new.scope_id;
  if not found or new.id<>'event:voucher:redemption:'||redeemed.id or new.aggregate_type<>'voucher'
    or new.aggregate_id<>redeemed.voucher_id or new.payload->>'voucher' is distinct from redeemed.voucher_id
    or new.payload->>'scope' is distinct from redeemed.scope_id or new.payload->>'currency' is distinct from redeemed.currency::text
    or (new.payload->>'amountMinor')::bigint is distinct from redeemed.amount_minor
    or new.payload->>'order' is distinct from redeemed.order_id then
    raise exception 'VOUCHER_REDEMPTION_EVENT_FACT_INVALID';
  end if;
  return new;
end $function$;
create trigger voucherevent before insert on runtime.outbox for each row when (new.event_type='voucher.redeemed') execute function runtime.guard_voucher_redemption();
revoke all on function runtime.guard_voucher_redemption() from public;

select runtime.record_migration_evidence('20260904029000',0,0,0,0,
  'select event_version,count(*) from runtime.outbox where event_type=''voucher.redeemed'' group by event_version;',
  'select event_id from runtime.inbox where event_type=''voucher.redeemed'' and event_version<>2 and processed_at is null;');
insert into runtime.schemaversion(version,checksum)
values('20260904029000',encode(public.digest('20260904029000_publish_voucher_redemption','sha256'),'hex'));

commit;
