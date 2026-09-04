begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904029200') then raise exception 'VOUCHER_REFUND_EVENT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904029300') then raise exception 'VOUCHER_REFUND_EVENT_ALREADY_APPLIED'; end if;
  -- Today's organization hierarchy cannot substitute for the original economic scope snapshot.
  if exists(select 1 from voucher.redemption) then raise exception 'VOUCHER_REDEMPTION_CONTEXT_EVIDENCE_REQUIRED'; end if;
end
$precondition$;

alter table voucher.redemption add column channel text not null check(channel in('order','store','manual'));
alter table voucher.redemption add column store_id text;
alter table voucher.redemption add column reporting_scopes text[] not null;
alter table voucher.redemption add column timezone text not null;
alter table voucher.redemption add constraint voucher_redemption_channel check(
  (channel='order' and order_id is not null and store_id is null)
  or (channel='store' and order_id is null and store_id is not null)
  or (channel='manual' and order_id is null and store_id is null));

create function voucher.guard_redemption_context()
returns trigger language plpgsql set search_path=pg_catalog,voucher,pg_temp as $$
begin
  if tg_op='UPDATE' then
    if (new.channel,new.store_id,new.reporting_scopes,new.timezone) is distinct from (old.channel,old.store_id,old.reporting_scopes,old.timezone) then
      raise exception 'VOUCHER_REDEMPTION_CONTEXT_IMMUTABLE';
    end if;
    return new;
  end if;
  if new.reporting_scopes is null or cardinality(new.reporting_scopes)=0
    or not new.scope_id=any(new.reporting_scopes) or array_position(new.reporting_scopes,null) is not null
    or ''=any(new.reporting_scopes) or cardinality(new.reporting_scopes)<>(select count(distinct scope) from unnest(new.reporting_scopes) scope)
    or (new.store_id is not null and not new.store_id=any(new.reporting_scopes))
    or not exists(select 1 from pg_timezone_names where name=new.timezone) then
    raise exception 'VOUCHER_REDEMPTION_CONTEXT_INVALID';
  end if;
  return new;
end
$$;
create trigger voucher_redemption_context before insert or update on voucher.redemption
for each row execute function voucher.guard_redemption_context();

insert into runtime.event(type,version,owner,schema_ref)
values('voucher.refunded',1,'voucher','contract://events/voucher.refunded/v1');

create or replace function runtime.guard_voucher_redemption() returns trigger language plpgsql set search_path=runtime,voucher,pg_temp as $function$
declare redeemed voucher.redemption%rowtype;
begin
  if new.event_version<>2 or new.payload_version<>2 then raise exception 'VOUCHER_REDEMPTION_EVENT_VERSION_INVALID'; end if;
  select * into redeemed from voucher.redemption where id=new.payload->>'redemption' and scope_id=new.scope_id;
  if not found or new.id<>'event:voucher:redemption:'||redeemed.id or new.aggregate_type<>'voucher'
    or new.aggregate_id<>redeemed.voucher_id or new.payload->>'voucher' is distinct from redeemed.voucher_id
    or new.payload->>'scope' is distinct from redeemed.scope_id or new.payload->>'currency' is distinct from redeemed.currency::text
    or (new.payload->>'amountMinor')::bigint is distinct from redeemed.amount_minor
    or new.payload->>'order' is distinct from redeemed.order_id or new.payload->>'store' is distinct from redeemed.store_id
    or new.payload->>'channel' is distinct from redeemed.channel or new.payload->>'timezone' is distinct from redeemed.timezone
    or new.payload->'scopes' is distinct from to_jsonb(redeemed.reporting_scopes) or new.occurred_at is distinct from redeemed.redeemed_at then
    raise exception 'VOUCHER_REDEMPTION_EVENT_FACT_INVALID';
  end if;
  return new;
end $function$;

create function runtime.guard_voucher_refund() returns trigger language plpgsql set search_path=runtime,voucher,pg_temp as $function$
declare refunded voucher.refund%rowtype; redeemed voucher.redemption%rowtype;
begin
  if new.event_version<>1 or new.payload_version<>1 then raise exception 'VOUCHER_REFUND_EVENT_VERSION_INVALID'; end if;
  select * into refunded from voucher.refund where id=new.payload->>'refund' and scope_id=new.scope_id;
  if not found then raise exception 'VOUCHER_REFUND_EVENT_FACT_INVALID'; end if;
  select * into redeemed from voucher.redemption where id=refunded.redemption_id and scope_id=refunded.scope_id;
  if not found or new.id<>'event:voucher:refund:'||refunded.id or new.aggregate_type<>'voucher'
    or new.aggregate_id<>redeemed.voucher_id or new.payload->>'voucher' is distinct from redeemed.voucher_id
    or new.payload->>'redemption' is distinct from redeemed.id or new.payload->>'scope' is distinct from refunded.scope_id
    or new.payload->>'currency' is distinct from refunded.currency::text or (new.payload->>'amountMinor')::bigint is distinct from refunded.amount_minor
    or (new.payload->>'ruleVersion')::bigint is distinct from refunded.rule_version or new.occurred_at is distinct from refunded.created_at
    or new.payload->>'order' is distinct from redeemed.order_id or new.payload->>'store' is distinct from redeemed.store_id
    or new.payload->>'channel' is distinct from redeemed.channel or new.payload->>'timezone' is distinct from redeemed.timezone
    or new.payload->'scopes' is distinct from to_jsonb(redeemed.reporting_scopes) then
    raise exception 'VOUCHER_REFUND_EVENT_FACT_INVALID';
  end if;
  return new;
end $function$;
create trigger voucherrefundevent before insert on runtime.outbox for each row when(new.event_type='voucher.refunded') execute function runtime.guard_voucher_refund();
revoke all on function voucher.guard_redemption_context(),runtime.guard_voucher_refund() from public;

select runtime.record_migration_evidence('20260904029300',0,0,0,0,
  'select channel,currency,count(*) from voucher.redemption group by channel,currency;',
  'select event_id from runtime.inbox where event_type=''voucher.refunded'' and processed_at is null;');
insert into runtime.schemaversion(version,checksum)
values('20260904029300',encode(public.digest('20260904029300_publish_voucher_refunds','sha256'),'hex'));

commit;
