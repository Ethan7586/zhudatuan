begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904029000') then raise exception 'VOUCHER_REFUND_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904029100') then raise exception 'VOUCHER_REFUND_ALREADY_APPLIED'; end if;
  if exists(select 1 from voucher.redemption) then raise exception 'VOUCHER_REDEMPTION_HOLDER_EVIDENCE_REQUIRED'; end if;
end $precondition$;

alter table voucher.holder add constraint voucher_holder_identity unique(id,scope_id,voucher_id);
alter table voucher.redemption add column holder_id text;
alter table voucher.redemption add constraint voucher_redemption_holder foreign key(holder_id,scope_id,voucher_id) references voucher.holder(id,scope_id,voucher_id);
alter table voucher.redemption add constraint voucher_redemption_identity unique(id,scope_id);
alter table voucher.refund add constraint voucher_refund_scope foreign key(redemption_id,scope_id) references voucher.redemption(id,scope_id);
create index voucher_refund_redemption on voucher.refund(redemption_id,scope_id) include(amount_minor);

create function voucher.capture_redemption_holder() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
declare parent voucher.voucher%rowtype;
begin
  select * into parent from voucher.voucher where id=new.voucher_id and scope_id=new.scope_id for update;
  if not found or new.holder_id is not null and new.holder_id is distinct from parent.holder_id then raise exception 'VOUCHER_REDEMPTION_CONFLICT'; end if;
  if parent.holder_id is not null and not exists(select 1 from voucher.holder where id=parent.holder_id and voucher_id=parent.id and scope_id=parent.scope_id and state='bound') then
    raise exception 'VOUCHER_REDEMPTION_CONFLICT';
  end if;
  new.holder_id=parent.holder_id;
  return new;
end $function$;
create trigger voucherredemptionholder before insert on voucher.redemption for each row execute function voucher.capture_redemption_holder();

create function voucher.guard_redemption_identity() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if row(new.id,new.scope_id,new.voucher_id,new.hold_id,new.verification_id,new.order_id,new.amount_minor,new.currency,new.idempotency_key,new.redeemed_at,new.holder_id)
    is distinct from row(old.id,old.scope_id,old.voucher_id,old.hold_id,old.verification_id,old.order_id,old.amount_minor,old.currency,old.idempotency_key,old.redeemed_at,old.holder_id) then
    raise exception 'VOUCHER_REDEMPTION_IMMUTABLE';
  end if;
  return new;
end $function$;
create trigger voucherredemptionidentity before update on voucher.redemption for each row execute function voucher.guard_redemption_identity();

-- Deferred comparison observes the completed transaction, not the intermediate
-- state between appending a refund receipt and advancing its parent total.
create function voucher.guard_refund_total() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
declare reference text; consistent boolean;
begin
  if tg_table_name='refund' then reference=new.redemption_id; else reference=new.id; end if;
  select redemption.refunded_minor=coalesce((select sum(amount_minor) from voucher.refund where redemption_id=reference and scope_id=new.scope_id),0)
    into consistent from voucher.redemption redemption where redemption.id=reference and redemption.scope_id=new.scope_id;
  if not coalesce(consistent,false) then raise exception 'VOUCHER_REFUND_TOTAL_MISMATCH'; end if;
  return null;
end $function$;
create constraint trigger voucherrefundtotal after insert on voucher.refund deferrable initially deferred for each row execute function voucher.guard_refund_total();
create constraint trigger voucherredemptiontotal after insert or update on voucher.redemption deferrable initially deferred for each row execute function voucher.guard_refund_total();

create or replace function voucher.guard_holder_transition() returns trigger language plpgsql set search_path=voucher,pg_temp as $function$
begin
  if new.version<>old.version+1 or old.state='released' and new is distinct from old then raise exception 'VOUCHER_HOLDER_FINAL'; end if;
  if row(new.id,new.scope_id,new.member_id,new.voucher_id,new.bound_at) is distinct from row(old.id,old.scope_id,old.member_id,old.voucher_id,old.bound_at) then
    raise exception 'VOUCHER_HOLDER_IMMUTABLE';
  end if;
  return new;
end $function$;

create or replace function voucher.create_refund(
  p_id text,p_scope text,p_redemption text,p_amount bigint,p_reason text,p_rule_version bigint,p_idempotency text,p_created_at timestamptz
) returns voucher.refund language plpgsql set search_path=voucher,pg_temp as $function$
declare existing voucher.refund; redeemed voucher.redemption; created voucher.refund; total bigint; parent text;
begin
  select * into existing from voucher.refund where scope_id=p_scope and idempotency_key=p_idempotency;
  if found then
    if existing.redemption_id<>p_redemption or existing.amount_minor<>p_amount or existing.rule_version<>p_rule_version then raise exception 'VOUCHER_REDEMPTION_CONFLICT'; end if;
    return existing;
  end if;
  select voucher_id into parent from voucher.redemption where id=p_redemption and scope_id=p_scope;
  if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  perform 1 from voucher.voucher where id=parent and scope_id=p_scope for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  select * into redeemed from voucher.redemption where id=p_redemption and scope_id=p_scope for update;
  total=redeemed.refunded_minor+p_amount;
  if p_amount<=0 or total>redeemed.amount_minor then raise exception 'VOUCHER_REFUND_EXCEEDS_REDEMPTION'; end if;
  insert into voucher.refund(id,scope_id,redemption_id,amount_minor,currency,reason,state,rule_version,idempotency_key,created_at)
  values(p_id,p_scope,p_redemption,p_amount,redeemed.currency,p_reason,'succeeded',p_rule_version,p_idempotency,p_created_at) returning * into created;
  update voucher.redemption set refunded_minor=total,state=case when total=amount_minor then 'refunded' else 'partiallyrefunded' end,version=version+1
    where id=redeemed.id and scope_id=p_scope;
  return created;
end $function$;
revoke all on function voucher.capture_redemption_holder() from public;
revoke all on function voucher.guard_redemption_identity() from public;
revoke all on function voucher.guard_refund_total() from public;

select runtime.record_migration_evidence('20260904029100',0,0,0,0,
  'select scope_id,count(*),sum(amount_minor),sum(refunded_minor) from voucher.redemption group by scope_id;',
  'select redemption.id from voucher.redemption redemption join voucher.holder holder on holder.id=redemption.holder_id where holder.scope_id<>redemption.scope_id or holder.voucher_id<>redemption.voucher_id;');
insert into runtime.schemaversion(version,checksum)
values('20260904029100',encode(public.digest('20260904029100_prepare_voucher_refunds','sha256'),'hex'));

commit;
