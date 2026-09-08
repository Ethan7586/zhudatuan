begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904026000') then raise exception 'CHECKOUT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904027000') then raise exception 'CHECKOUT_ALREADY_APPLIED'; end if;
end $precondition$;

update checkout.session set state='expired',version=version+1 where state in('draft','quoted');
alter table checkout.session add column confirmation_digest char(64);
update checkout.session set confirmation_digest=encode(public.digest(id||':'||quote_hash,'sha256'),'hex');
alter table checkout.session alter column confirmation_digest set not null;
alter table checkout.session drop constraint session_state_check;
alter table checkout.session add constraint checkout_session_state check(state in('quoted','confirmed','expired','cancelled')) not valid;
alter table checkout.session add constraint checkout_session_version check(version>=0) not valid;
alter table checkout.session add constraint checkout_session_quote_hash check(quote_hash~'^[0-9a-f]{64}$') not valid;
alter table checkout.session add constraint checkout_session_confirmation_digest check(confirmation_digest~'^[0-9a-f]{64}$') not valid;
alter table checkout.session add constraint checkout_session_period check(expires_at>created_at) not valid;
alter table checkout.session validate constraint checkout_session_state;
alter table checkout.session validate constraint checkout_session_version;
alter table checkout.session validate constraint checkout_session_quote_hash;
alter table checkout.session validate constraint checkout_session_confirmation_digest;
alter table checkout.session validate constraint checkout_session_period;
create unique index checkout_quote_identity on checkout.session(quote_id);
create index checkout_current_member on checkout.session(member_id,mall_id,created_at desc,id desc) where state='quoted';

create function checkout.guard_session() returns trigger language plpgsql security definer
set search_path=checkout,pg_temp set row_security=off as $function$
begin
  if tg_op='INSERT' then
    if new.state<>'quoted' or new.version<>0 then raise exception 'CHECKOUT_INITIAL_STATE_INVALID'; end if;
    return new;
  end if;
  if (new.id,new.cart_id,new.member_id,new.mall_id,new.application_id,new.quote_id,new.quote_hash,new.confirmation_digest,
      new.address_id,new.input,new.expires_at,new.created_at)
    is distinct from
     (old.id,old.cart_id,old.member_id,old.mall_id,old.application_id,old.quote_id,old.quote_hash,old.confirmation_digest,
      old.address_id,old.input,old.expires_at,old.created_at)
    then raise exception 'CHECKOUT_IDENTITY_IMMUTABLE'; end if;
  if new.version<>old.version+1 then raise exception 'CHECKOUT_VERSION_CONFLICT'; end if;
  if old.state<>'quoted' then raise exception 'CHECKOUT_FINAL'; end if;
  if new.state not in('confirmed','expired','cancelled') then raise exception 'CHECKOUT_TRANSITION_INVALID'; end if;
  return new;
end
$function$;
create trigger checkoutsessionguard before insert or update on checkout.session for each row execute function checkout.guard_session();
revoke all on function checkout.guard_session() from public;

create table checkout.expiryreceipt(
  id char(64) primary key check(id~'^[0-9a-f]{64}$'),
  scope_id text not null,
  completed_at timestamptz not null
);
create index checkout_expiryreceipt_scope on checkout.expiryreceipt(scope_id,completed_at desc);
alter table checkout.expiryreceipt enable row level security;
alter table checkout.expiryreceipt force row level security;
create policy appread on checkout.expiryreceipt for select to shopapp using(access.scope_allowed(scope_id));
create policy jobwrite on checkout.expiryreceipt for all to shopjob using(true) with check(true);
grant select on checkout.expiryreceipt to shopapp;
grant select,insert on checkout.expiryreceipt to shopjob;

comment on column checkout.session.confirmation_digest is 'SHA-256 digest of the one-time quote confirmation bearer; the raw bearer is never persisted.';
comment on table checkout.evidence is 'Versioned dependency evidence for immutable checkout quote reconstruction and confirmation drift checks.';
comment on table checkout.expiryreceipt is 'Idempotent completion receipt for checkout and unpaid-order expiry processing.';

update runtime.operation set contract_version='5.0.0' where owner='checkout';
update capability.capability set version=version+1 where id in(select id from runtime.operation where owner='checkout');
update runtime.contractcatalog set checksum='5930316e6e7c7f5134993577810047d87c544d1bfd0c69ed4719556a24437759',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event where retired_at is null),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260904027000',(select count(*) from checkout.session),(select count(*) from checkout.session),0,0,
  'create index concurrently if not exists checkout_expiryreceipt_retention on checkout.expiryreceipt(completed_at);',
  'select state,count(*) from checkout.session group by state;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904027000',encode(public.digest('20260904027000_prepare_checkout','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from checkout.session where version<0 or state not in('quoted','confirmed','expired','cancelled') or expires_at<=created_at)
    then raise exception 'CHECKOUT_SESSION_INVARIANT_INVALID'; end if;
  if exists(select 1 from checkout.session where confirmation_digest!~'^[0-9a-f]{64}$' or quote_hash!~'^[0-9a-f]{64}$')
    then raise exception 'CHECKOUT_DIGEST_INVARIANT_INVALID'; end if;
  if exists(select 1 from checkout.session where state='quoted' group by cart_id having count(*)>1)
    then raise exception 'CHECKOUT_CURRENT_INVARIANT_INVALID'; end if;
  if (select count(*) from runtime.operation)<>313 then raise exception 'CHECKOUT_OPERATION_COUNT_INVALID'; end if;
  if (select count(*) from runtime.event where retired_at is null)<>143 then raise exception 'CHECKOUT_EVENT_COUNT_INVALID'; end if;
end $assert$;

commit;
