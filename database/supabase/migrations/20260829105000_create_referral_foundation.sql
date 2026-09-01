begin;

create schema referral;
revoke all on schema referral from public,anon,authenticated,service_role;

alter table ordering.orderrecord
  add constraint ordering_orderrecord_scope_identity unique(scope_id,id);
alter table ordering.line
  add constraint ordering_line_order_sku_identity unique(order_id,id,sku_id);
alter table finance.journal
  add constraint finance_journal_scope_identity unique(scope_id,id);
alter table finance.withdrawal
  add constraint finance_withdrawal_scope_identity unique(scope_id,id);

alter table finance.withdrawal
  alter column settlement_id drop not null,
  add column source_kind text not null default 'settlement'
    check(source_kind in('settlement','referral')),
  add column source_id text,
  add column beneficiary_member_id text references member.profile(id),
  add constraint finance_withdrawal_source_consistency check(
    (source_kind='settlement' and settlement_id is not null
      and (source_id is null or source_id=settlement_id) and beneficiary_member_id is null)
    or
    (source_kind='referral' and settlement_id is null
      and source_id is not null and source_id<>'' and beneficiary_member_id is not null)
  );
create index finance_withdrawal_referral_source
  on finance.withdrawal(scope_id,source_id,state,created_at desc)
  where source_kind='referral';

insert into finance.accountingeventrule(
  event_type,version,recognition,debit_roles,credit_roles,subledger_kind,reversal_event,effective_at
) values
  ('referral.commission.accrued',1,'Accrue member referral commission',
    array['legacy_expense'],array['legacy_liability'],null,'referral.commission.reversed','1970-01-01T00:00:00Z'),
  ('referral.commission.reversed',1,'Reverse member referral commission',
    array['legacy_liability'],array['legacy_expense'],null,'finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('referral.commission.recovery.accrued',1,'Reclassify paid reversed commission as member receivable',
    array['legacy_asset'],array['legacy_liability'],null,'finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('referral.commission.recovery.offset',1,'Offset future referral payable against member receivable',
    array['legacy_liability'],array['legacy_asset'],null,'finance.journal.reversal','1970-01-01T00:00:00Z'),
  ('referral.withdrawal.paid',1,'Clear member referral payable after confirmed payout',
    array['legacy_liability'],array['cash'],null,'finance.journal.reversal','1970-01-01T00:00:00Z');

create or replace function runtime.reject_financial_outbox_fact_mutation()
returns trigger language plpgsql set search_path=runtime,pg_temp as $function$
declare financial_fact boolean;
begin
  financial_fact:=old.event_type like 'finance.%' or old.event_type like 'invoice.%'
    or old.event_type like 'referral.%'
    or old.event_type in('order.placed','order.paid','order.received','order.cancelled',
      'payment.succeeded','payment.refunded','payment.late.detected','payment.late.refunded',
      'payment.autorefund.requested');
  if tg_op='DELETE' then
    if financial_fact and (old.published_at is null
      or old.occurred_at>clock_timestamp()-interval '90 days')
    then raise exception 'FINANCIAL_EVENT_FACT_RETENTION_REQUIRED'; end if;
    return old;
  end if;
  financial_fact:=financial_fact or new.event_type like 'finance.%' or new.event_type like 'invoice.%'
    or new.event_type like 'referral.%'
    or new.event_type in('order.placed','order.paid','order.received','order.cancelled',
      'payment.succeeded','payment.refunded','payment.late.detected','payment.late.refunded',
      'payment.autorefund.requested');
  if financial_fact
    and (new.event_type,new.event_version,new.scope_id,new.payload,new.occurred_at,new.trace_id)
      is distinct from
      (old.event_type,old.event_version,old.scope_id,old.payload,old.occurred_at,old.trace_id)
  then raise exception 'FINANCIAL_EVENT_FACT_IMMUTABLE'; end if;
  return new;
end $function$;

create or replace function runtime.reject_financial_inbox_fact_mutation()
returns trigger language plpgsql set search_path=runtime,pg_temp as $function$
declare financial_fact boolean;
begin
  financial_fact:=old.event_type like 'finance.%' or old.event_type like 'invoice.%'
    or old.event_type like 'referral.%'
    or old.event_type in('order.placed','order.paid','order.received','order.cancelled',
      'payment.succeeded','payment.refunded','payment.late.detected','payment.late.refunded',
      'payment.autorefund.requested');
  if tg_op='DELETE' then
    if financial_fact and (old.processed_at is null
      or old.received_at>clock_timestamp()-interval '90 days')
    then raise exception 'FINANCIAL_EVENT_FACT_RETENTION_REQUIRED'; end if;
    return old;
  end if;
  financial_fact:=financial_fact or new.event_type like 'finance.%' or new.event_type like 'invoice.%'
    or new.event_type like 'referral.%'
    or new.event_type in('order.placed','order.paid','order.received','order.cancelled',
      'payment.succeeded','payment.refunded','payment.late.detected','payment.late.refunded',
      'payment.autorefund.requested');
  if financial_fact
    and (new.event_type,new.event_version,new.payload,new.trace_id)
      is distinct from (old.event_type,old.event_version,old.payload,old.trace_id)
  then raise exception 'FINANCIAL_EVENT_FACT_IMMUTABLE'; end if;
  return new;
end $function$;

create table referral.setting(
  id text primary key check(id<>''),
  scope_id text not null check(scope_id<>''),
  enabled boolean not null default false,
  recruit_enabled boolean not null default false,
  review_required boolean not null default true,
  reward_enabled boolean not null default false,
  binding_mode text not null check(binding_mode in('permanent','days')),
  binding_days integer,
  settle_trigger text not null check(settle_trigger in('on_paid','on_received')),
  settle_delay_days integer not null default 0 check(settle_delay_days between 0 and 3650),
  withdraw_min_minor bigint not null default 0 check(withdraw_min_minor>=0),
  withdraw_monthly_max integer check(withdraw_monthly_max is null or withdraw_monthly_max>0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  version bigint not null default 0 check(version>=0),
  unique(scope_id),
  unique(scope_id,id),
  check((binding_mode='permanent' and binding_days is null)
    or (binding_mode='days' and binding_days between 1 and 3650))
);

create table referral.product(
  id text primary key check(id<>''),
  scope_id text not null check(scope_id<>''),
  sku_id text not null references catalog.sku(id),
  commission_bps integer not null check(commission_bps between 0 and 10000),
  reward_bps integer not null default 0 check(reward_bps between 0 and 10000),
  enabled boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  version bigint not null default 0 check(version>=0),
  unique(scope_id,id),
  unique(scope_id,sku_id),
  check(commission_bps+reward_bps<=10000)
);

create table referral.member(
  id text primary key check(id<>''),
  scope_id text not null check(scope_id<>''),
  member_id text not null references member.profile(id),
  inviter_member_id text,
  state text not null check(state in('pending','active','disqualified')),
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  version bigint not null default 0 check(version>=0),
  unique(scope_id,id),
  unique(scope_id,member_id),
  foreign key(scope_id,inviter_member_id) references referral.member(scope_id,id),
  check(inviter_member_id is null or inviter_member_id<>id),
  check((state='pending' and approved_by is null and approved_at is null)
    or (state in('active','disqualified') and approved_by is not null and approved_at is not null))
);

create table referral.binding(
  id text primary key check(id<>''),
  scope_id text not null check(scope_id<>''),
  customer_member_id text not null references member.profile(id),
  referral_member_id text not null,
  bound_at timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  version bigint not null default 0 check(version>=0),
  unique(scope_id,id),
  unique(scope_id,customer_member_id),
  foreign key(scope_id,referral_member_id) references referral.member(scope_id,id),
  check(expires_at is null or expires_at>bound_at)
);

create table referral.commission(
  id text primary key check(id<>''),
  scope_id text not null check(scope_id<>''),
  order_id text not null,
  order_line_id text not null,
  sku_id text not null,
  beneficiary_member_id text not null,
  kind text not null check(kind in('commission','reward')),
  currency char(3) not null check(currency~'^[A-Z]{3}$'),
  base_minor bigint not null check(base_minor>0),
  rate_bps integer not null check(rate_bps between 1 and 10000),
  amount_minor bigint not null check(amount_minor>0),
  reversed_base_minor bigint not null default 0,
  reversed_minor bigint not null default 0,
  state text not null check(state in('pending','settling','settled','reversed')),
  origin_event_id text not null check(origin_event_id<>''),
  setting_version bigint not null check(setting_version>=0),
  product_version bigint not null check(product_version>=0),
  settle_trigger text not null check(settle_trigger in('on_paid','on_received')),
  settle_delay_days integer not null check(settle_delay_days between 0 and 3650),
  eligible_at timestamptz,
  journal_id text,
  reversal_journal_id text,
  reversal_event_id text,
  settling_at timestamptz,
  settled_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  version bigint not null default 0 check(version>=0),
  unique(scope_id,id),
  unique(scope_id,id,beneficiary_member_id),
  unique(scope_id,origin_event_id,order_line_id,kind,beneficiary_member_id),
  foreign key(scope_id,order_id) references ordering.orderrecord(scope_id,id),
  foreign key(order_id,order_line_id,sku_id) references ordering.line(order_id,id,sku_id),
  foreign key(scope_id,sku_id) references referral.product(scope_id,sku_id),
  foreign key(scope_id,beneficiary_member_id) references referral.member(scope_id,member_id),
  foreign key(scope_id,journal_id) references finance.journal(scope_id,id),
  foreign key(scope_id,reversal_journal_id) references finance.journal(scope_id,id),
  check(amount_minor=floor(base_minor::numeric*rate_bps/10000)::bigint),
  check(reversed_base_minor between 0 and base_minor),
  check(reversed_minor between 0 and amount_minor),
  check(reversal_journal_id is null or reversal_journal_id<>journal_id),
  check(
    (state='pending' and reversed_base_minor<base_minor and reversed_minor<amount_minor
      and settling_at is null and settled_at is null and journal_id is null
      and reversal_journal_id is null and reversal_event_id is null and reversed_at is null)
    or
    (state='settling' and reversed_base_minor<base_minor and reversed_minor<amount_minor
      and eligible_at is not null and settling_at is not null and settled_at is null and journal_id is null
      and reversal_journal_id is null and reversal_event_id is null and reversed_at is null)
    or
    (state='settled' and reversed_base_minor<base_minor and reversed_minor<amount_minor
      and eligible_at is not null and settling_at is not null and settled_at is not null and journal_id is not null
      and reversal_journal_id is null and reversal_event_id is null and reversed_at is null)
    or
    (state='reversed' and reversed_base_minor=base_minor and reversed_minor=amount_minor
      and reversal_event_id is not null and reversed_at is not null
      and ((journal_id is null and settled_at is null and reversal_journal_id is null)
        or (journal_id is not null and settled_at is not null and reversal_journal_id is not null)))
  )
);

create table referral.commissionmovement(
  id text primary key check(id<>''),
  scope_id text not null check(scope_id<>''),
  commission_id text not null,
  beneficiary_member_id text not null,
  origin_event_id text not null check(origin_event_id<>''),
  refund_id text,
  kind text not null default 'reversal' check(kind='reversal'),
  base_minor bigint not null check(base_minor>0),
  amount_minor bigint not null check(amount_minor>0),
  journal_id text,
  created_at timestamptz not null default clock_timestamp(),
  unique(scope_id,id),
  unique(scope_id,commission_id,origin_event_id,kind),
  foreign key(scope_id,commission_id,beneficiary_member_id)
    references referral.commission(scope_id,id,beneficiary_member_id),
  foreign key(scope_id,journal_id) references finance.journal(scope_id,id),
  check(refund_id is null or refund_id<>'')
);

create unique index referral_commissionmovement_refund
  on referral.commissionmovement(scope_id,commission_id,refund_id,kind)
  where refund_id is not null;

create table referral.recoverymovement(
  id text primary key check(id<>''),
  scope_id text not null check(scope_id<>''),
  beneficiary_member_id text not null,
  kind text not null check(kind in('accrual','offset')),
  source_commission_id text not null,
  settlement_commission_id text,
  reversal_movement_id text,
  recovery_id text,
  origin_event_id text not null check(origin_event_id<>''),
  currency char(3) not null check(currency~'^[A-Z]{3}$'),
  amount_minor bigint not null check(amount_minor>0),
  journal_id text not null,
  created_at timestamptz not null default clock_timestamp(),
  unique(scope_id,id),
  foreign key(scope_id,source_commission_id,beneficiary_member_id)
    references referral.commission(scope_id,id,beneficiary_member_id),
  foreign key(scope_id,settlement_commission_id,beneficiary_member_id)
    references referral.commission(scope_id,id,beneficiary_member_id),
  foreign key(scope_id,reversal_movement_id) references referral.commissionmovement(scope_id,id),
  foreign key(scope_id,recovery_id) references referral.recoverymovement(scope_id,id),
  foreign key(scope_id,journal_id) references finance.journal(scope_id,id),
  check(
    (kind='accrual' and settlement_commission_id is null and reversal_movement_id is not null and recovery_id is null)
    or
    (kind='offset' and settlement_commission_id is not null and reversal_movement_id is null and recovery_id is not null
      and source_commission_id<>settlement_commission_id)
  )
);

create unique index referral_recoverymovement_reversal
  on referral.recoverymovement(scope_id,reversal_movement_id)
  where kind='accrual';
create unique index referral_recoverymovement_offset
  on referral.recoverymovement(scope_id,recovery_id,settlement_commission_id)
  where kind='offset';

create table referral.withdrawalclaim(
  id text primary key check(id<>''),
  scope_id text not null check(scope_id<>''),
  beneficiary_member_id text not null,
  commission_id text not null,
  withdrawal_id text,
  amount_minor bigint not null check(amount_minor>0),
  state text not null check(state in(
    'reserved','submitted','approved','processing','paid','rejected','failed','uncertain','cancelled'
  )),
  requested_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  version bigint not null default 0 check(version>=0),
  unique(scope_id,id),
  foreign key(scope_id,commission_id,beneficiary_member_id)
    references referral.commission(scope_id,id,beneficiary_member_id),
  foreign key(scope_id,withdrawal_id) references finance.withdrawal(scope_id,id),
  check((state='reserved' and withdrawal_id is null)
    or state='cancelled'
    or (state in('submitted','approved','processing','paid','rejected','failed','uncertain') and withdrawal_id is not null))
);

create unique index referral_withdrawalclaim_withdrawal_commission
  on referral.withdrawalclaim(withdrawal_id,commission_id)
  where withdrawal_id is not null;

create index referral_product_enabled on referral.product(scope_id,enabled,sku_id);
create index referral_member_state on referral.member(scope_id,state,id);
create index referral_member_inviter on referral.member(scope_id,inviter_member_id) where inviter_member_id is not null;
create index referral_binding_winner on referral.binding(scope_id,referral_member_id,bound_at desc);
create index referral_binding_expiry on referral.binding(scope_id,expires_at) where expires_at is not null;
create index referral_commission_settlement on referral.commission(scope_id,state,eligible_at,id);
create index referral_commission_beneficiary on referral.commission(scope_id,beneficiary_member_id,state,created_at desc);
create index referral_commission_order on referral.commission(scope_id,order_id,order_line_id);
create index referral_commissionmovement_refund_lookup on referral.commissionmovement(scope_id,refund_id,created_at desc)
  where refund_id is not null;
create index referral_recoverymovement_beneficiary
  on referral.recoverymovement(scope_id,beneficiary_member_id,currency,created_at,id);
create index referral_recoverymovement_source
  on referral.recoverymovement(scope_id,source_commission_id,kind);
create index referral_recoverymovement_settlement
  on referral.recoverymovement(scope_id,settlement_commission_id)
  where settlement_commission_id is not null;
create index referral_withdrawalclaim_withdrawal on referral.withdrawalclaim(scope_id,withdrawal_id)
  where withdrawal_id is not null;
create index referral_withdrawalclaim_beneficiary on referral.withdrawalclaim(scope_id,beneficiary_member_id,state,requested_at desc);

create function referral.bind_first_touch(
  p_id text,
  p_scope text,
  p_customer_member text,
  p_referral_member text,
  p_bound_at timestamptz default clock_timestamp()
) returns table(
  binding_id text,
  winner_referral_member_id text,
  created boolean,
  winner_bound_at timestamptz,
  winner_expires_at timestamptz
) language plpgsql volatile
set search_path=referral,member,pg_temp as $function$
declare
  bindingmode text;
  bindingdays integer;
  candidate_member_id text;
  proposed_expires_at timestamptz;
  current_binding referral.binding%rowtype;
begin
  if p_id is null or p_id='' or p_scope is null or p_scope=''
    or p_customer_member is null or p_customer_member=''
    or p_referral_member is null or p_referral_member='' or p_bound_at is null
  then raise exception 'REFERRAL_BINDING_INPUT_INVALID'; end if;

  select target.binding_mode,target.binding_days
  into bindingmode,bindingdays
  from referral.setting target
  where target.scope_id=p_scope and target.enabled
  for share;
  if not found then raise exception 'REFERRAL_NOT_ENABLED'; end if;

  select target.member_id
  into candidate_member_id
  from referral.member target
  where target.scope_id=p_scope and target.id=p_referral_member and target.state='active'
  for share;
  if not found then raise exception 'REFERRAL_MEMBER_NOT_ACTIVE'; end if;
  if candidate_member_id=p_customer_member then raise exception 'REFERRAL_SELF_BINDING_FORBIDDEN'; end if;

  proposed_expires_at:=case when bindingmode='days'
    then p_bound_at+make_interval(days=>bindingdays) else null end;

  loop
    select target.* into current_binding
    from referral.binding target
    where target.scope_id=p_scope and target.customer_member_id=p_customer_member
    for update;
    if found then
      if current_binding.expires_at is null or current_binding.expires_at>p_bound_at then
        return query select current_binding.id,current_binding.referral_member_id,false,
          current_binding.bound_at,current_binding.expires_at;
        return;
      end if;
      update referral.binding target set
        referral_member_id=p_referral_member,
        bound_at=p_bound_at,
        expires_at=proposed_expires_at,
        updated_at=clock_timestamp(),
        version=target.version+1
      where target.scope_id=p_scope and target.id=current_binding.id
        and target.expires_at is not null and target.expires_at<=p_bound_at
      returning target.* into current_binding;
      if found then
        return query select current_binding.id,current_binding.referral_member_id,true,
          current_binding.bound_at,current_binding.expires_at;
        return;
      end if;
    else
      insert into referral.binding(
        id,scope_id,customer_member_id,referral_member_id,bound_at,expires_at
      ) values(
        p_id,p_scope,p_customer_member,p_referral_member,p_bound_at,proposed_expires_at
      ) on conflict(scope_id,customer_member_id) do nothing
      returning * into current_binding;
      if found then
        return query select current_binding.id,current_binding.referral_member_id,true,
          current_binding.bound_at,current_binding.expires_at;
        return;
      end if;
      if exists(select 1 from referral.binding target where target.id=p_id
        and (target.scope_id<>p_scope or target.customer_member_id<>p_customer_member))
      then raise exception 'REFERRAL_BINDING_ID_CONFLICT'; end if;
    end if;
  end loop;
end $function$;

create function referral.apply_commission_reversal()
returns trigger language plpgsql volatile
set search_path=referral,finance,pg_temp as $function$
declare
  target referral.commission%rowtype;
  existing_movement referral.commissionmovement%rowtype;
  next_reversed_base bigint;
  next_reversed_minor bigint;
  fully_reversed boolean;
begin
  select commission.* into target
  from referral.commission commission
  where commission.scope_id=new.scope_id and commission.id=new.commission_id
    and commission.beneficiary_member_id=new.beneficiary_member_id
  for update;
  if not found then raise exception 'REFERRAL_COMMISSION_NOT_FOUND'; end if;
  select movement.* into existing_movement
  from referral.commissionmovement movement
  where movement.scope_id=new.scope_id and movement.commission_id=new.commission_id
    and (movement.origin_event_id=new.origin_event_id
      or (new.refund_id is not null and movement.refund_id=new.refund_id))
  order by movement.id
  limit 1;
  if found then
    if existing_movement.beneficiary_member_id<>new.beneficiary_member_id
      or existing_movement.origin_event_id<>new.origin_event_id
      or existing_movement.refund_id is distinct from new.refund_id
      or existing_movement.kind<>new.kind
      or existing_movement.base_minor<>new.base_minor
      or existing_movement.amount_minor<>new.amount_minor
      or existing_movement.journal_id is distinct from new.journal_id
    then raise exception 'REFERRAL_REVERSAL_IDEMPOTENCY_MISMATCH'; end if;
    return null;
  end if;
  if target.state='reversed' then raise exception 'REFERRAL_COMMISSION_ALREADY_REVERSED'; end if;
  if new.base_minor>target.base_minor-target.reversed_base_minor
    or new.amount_minor>target.amount_minor-target.reversed_minor
  then raise exception 'REFERRAL_REVERSAL_EXCEEDS_REMAINING'; end if;
  if target.state='settled' and new.journal_id is null
  then raise exception 'REFERRAL_SETTLED_REVERSAL_JOURNAL_REQUIRED'; end if;
  if target.state<>'settled' and new.journal_id is not null
  then raise exception 'REFERRAL_UNSETTLED_REVERSAL_JOURNAL_FORBIDDEN'; end if;
  if new.journal_id is not null and new.journal_id=target.journal_id
  then raise exception 'REFERRAL_REVERSAL_JOURNAL_MUST_DIFFER'; end if;

  next_reversed_base:=target.reversed_base_minor+new.base_minor;
  next_reversed_minor:=target.reversed_minor+new.amount_minor;
  fully_reversed:=next_reversed_base=target.base_minor and next_reversed_minor=target.amount_minor;

  update referral.commission commission set
    reversed_base_minor=next_reversed_base,
    reversed_minor=next_reversed_minor,
    state=case when fully_reversed then 'reversed' else commission.state end,
    reversal_journal_id=case when fully_reversed then new.journal_id else commission.reversal_journal_id end,
    reversal_event_id=case when fully_reversed then new.origin_event_id else commission.reversal_event_id end,
    reversed_at=case when fully_reversed then new.created_at else commission.reversed_at end,
    updated_at=clock_timestamp(),
    version=commission.version+1
  where commission.scope_id=new.scope_id and commission.id=new.commission_id;
  return new;
end $function$;

create function referral.reject_commissionmovement_mutation()
returns trigger language plpgsql volatile as $function$
begin
  raise exception 'REFERRAL_COMMISSION_MOVEMENT_IMMUTABLE';
end $function$;

create function referral.validate_recoverymovement()
returns trigger language plpgsql volatile
set search_path=referral,finance,pg_temp as $function$
declare
  existing_movement referral.recoverymovement%rowtype;
  source_commission referral.commission%rowtype;
  settlement_commission referral.commission%rowtype;
  recovery_movement referral.recoverymovement%rowtype;
  used_minor bigint;
  claimed_minor bigint;
begin
  perform 1 from referral.member target
  where target.scope_id=new.scope_id and target.member_id=new.beneficiary_member_id
  for update;
  if not found then raise exception 'REFERRAL_RECOVERY_MEMBER_NOT_FOUND'; end if;

  select movement.* into existing_movement
  from referral.recoverymovement movement
  where movement.scope_id=new.scope_id and (
    movement.id=new.id
    or (new.kind='accrual' and movement.kind='accrual'
      and movement.reversal_movement_id=new.reversal_movement_id)
    or (new.kind='offset' and movement.kind='offset'
      and movement.recovery_id=new.recovery_id
      and movement.settlement_commission_id=new.settlement_commission_id)
  ) order by movement.id limit 1;
  if found then
    if (existing_movement.id,existing_movement.beneficiary_member_id,existing_movement.kind,
        existing_movement.source_commission_id,existing_movement.settlement_commission_id,
        existing_movement.reversal_movement_id,existing_movement.recovery_id,
        existing_movement.origin_event_id,existing_movement.currency,existing_movement.amount_minor,
        existing_movement.journal_id,existing_movement.created_at)
      is distinct from
       (new.id,new.beneficiary_member_id,new.kind,new.source_commission_id,new.settlement_commission_id,
        new.reversal_movement_id,new.recovery_id,new.origin_event_id,new.currency,new.amount_minor,
        new.journal_id,new.created_at)
    then raise exception 'REFERRAL_RECOVERY_IDEMPOTENCY_MISMATCH'; end if;
    return null;
  end if;

  select commission.* into source_commission
  from referral.commission commission
  where commission.scope_id=new.scope_id and commission.id=new.source_commission_id
    and commission.beneficiary_member_id=new.beneficiary_member_id;
  if not found or source_commission.currency<>new.currency
  then raise exception 'REFERRAL_RECOVERY_SOURCE_MISMATCH'; end if;

  if new.kind='accrual' then
    if not exists(
      select 1 from referral.commissionmovement reversal
      where reversal.scope_id=new.scope_id and reversal.id=new.reversal_movement_id
        and reversal.commission_id=new.source_commission_id
        and reversal.beneficiary_member_id=new.beneficiary_member_id
        and reversal.origin_event_id=new.origin_event_id
        and reversal.amount_minor>=new.amount_minor
    ) then raise exception 'REFERRAL_RECOVERY_REVERSAL_MISMATCH'; end if;
    return new;
  end if;

  select movement.* into recovery_movement
  from referral.recoverymovement movement
  where movement.scope_id=new.scope_id and movement.id=new.recovery_id
    and movement.kind='accrual'
  for update;
  if not found
    or recovery_movement.source_commission_id<>new.source_commission_id
    or recovery_movement.beneficiary_member_id<>new.beneficiary_member_id
    or recovery_movement.currency<>new.currency
  then raise exception 'REFERRAL_RECOVERY_OFFSET_SOURCE_MISMATCH'; end if;
  select coalesce(sum(movement.amount_minor),0) into used_minor
  from referral.recoverymovement movement
  where movement.scope_id=new.scope_id and movement.kind='offset'
    and movement.recovery_id=new.recovery_id;
  if new.amount_minor>recovery_movement.amount_minor-used_minor
  then raise exception 'REFERRAL_RECOVERY_OFFSET_EXCEEDS_OUTSTANDING'; end if;

  select commission.* into settlement_commission
  from referral.commission commission
  where commission.scope_id=new.scope_id and commission.id=new.settlement_commission_id
    and commission.beneficiary_member_id=new.beneficiary_member_id;
  if not found or settlement_commission.currency<>new.currency
    or settlement_commission.state not in('settling','settled')
    or settlement_commission.origin_event_id<>new.origin_event_id
  then raise exception 'REFERRAL_RECOVERY_SETTLEMENT_MISMATCH'; end if;
  select coalesce(sum(claim.amount_minor),0) into claimed_minor
  from referral.withdrawalclaim claim
  where claim.scope_id=new.scope_id and claim.commission_id=new.settlement_commission_id
    and claim.state not in('rejected','cancelled');
  select coalesce(sum(movement.amount_minor),0) into used_minor
  from referral.recoverymovement movement
  where movement.scope_id=new.scope_id and movement.kind='offset'
    and movement.settlement_commission_id=new.settlement_commission_id;
  if new.amount_minor>settlement_commission.amount_minor-settlement_commission.reversed_minor-claimed_minor-used_minor
  then raise exception 'REFERRAL_RECOVERY_OFFSET_EXCEEDS_PAYABLE'; end if;
  return new;
end $function$;

create function referral.reject_recoverymovement_mutation()
returns trigger language plpgsql volatile as $function$
begin
  raise exception 'REFERRAL_RECOVERY_MOVEMENT_IMMUTABLE';
end $function$;

create function referral.validate_withdrawal_claim()
returns trigger language plpgsql volatile
set search_path=referral,pg_temp as $function$
declare
  target referral.commission%rowtype;
  claimed_minor bigint;
  offset_minor bigint;
begin
  if new.state<>'reserved' or new.withdrawal_id is not null
  then raise exception 'REFERRAL_WITHDRAWAL_CLAIM_INITIAL_STATE_INVALID'; end if;
  perform 1 from referral.member member
  where member.scope_id=new.scope_id and member.member_id=new.beneficiary_member_id
  for update;
  if not found then raise exception 'REFERRAL_WITHDRAW_MEMBER_NOT_FOUND'; end if;
  select commission.* into target
  from referral.commission commission
  where commission.scope_id=new.scope_id and commission.id=new.commission_id
    and commission.beneficiary_member_id=new.beneficiary_member_id;
  if not found then raise exception 'REFERRAL_COMMISSION_NOT_FOUND'; end if;
  if target.state<>'settled' then raise exception 'REFERRAL_COMMISSION_NOT_WITHDRAWABLE'; end if;
  select coalesce(sum(claim.amount_minor),0) into claimed_minor
  from referral.withdrawalclaim claim
  where claim.scope_id=new.scope_id and claim.commission_id=new.commission_id
    and claim.state not in('rejected','cancelled');
  select coalesce(sum(movement.amount_minor),0) into offset_minor
  from referral.recoverymovement movement
  where movement.scope_id=new.scope_id and movement.kind='offset'
    and movement.settlement_commission_id=new.commission_id;
  if new.amount_minor>target.amount_minor-target.reversed_minor-claimed_minor-offset_minor
  then raise exception 'REFERRAL_WITHDRAWAL_CLAIM_AMOUNT_EXCEEDS_AVAILABLE'; end if;
  return new;
end $function$;

create function referral.protect_withdrawal_claim_identity()
returns trigger language plpgsql volatile
set search_path=referral,finance,pg_temp as $function$
declare
  target finance.withdrawal%rowtype;
  claim_currency text;
begin
  if new.id<>old.id or new.scope_id<>old.scope_id or new.commission_id<>old.commission_id
    or new.beneficiary_member_id<>old.beneficiary_member_id or new.amount_minor<>old.amount_minor
    or new.requested_at<>old.requested_at
  then raise exception 'REFERRAL_WITHDRAWAL_CLAIM_IDENTITY_IMMUTABLE'; end if;

  if new.version<>old.version+1
  then raise exception 'REFERRAL_WITHDRAW_CLAIM_EVIDENCE_MISMATCH'; end if;
  if old.state='reserved' and old.withdrawal_id is null then
    if new.state<>'submitted' or new.withdrawal_id is null
    then raise exception 'REFERRAL_WITHDRAW_CLAIM_EVIDENCE_MISMATCH'; end if;
  elsif new.withdrawal_id is distinct from old.withdrawal_id then
    raise exception 'REFERRAL_WITHDRAWAL_CLAIM_IDENTITY_IMMUTABLE';
  end if;

  select withdrawal.* into target
  from finance.withdrawal withdrawal
  where withdrawal.scope_id=new.scope_id and withdrawal.id=new.withdrawal_id;
  if not found then raise exception 'REFERRAL_WITHDRAW_CLAIM_EVIDENCE_MISMATCH'; end if;
  select commission.currency into claim_currency
  from referral.commission commission
  where commission.scope_id=new.scope_id and commission.id=new.commission_id;
  if not found or target.source_kind<>'referral' or target.state<>new.state
    or target.beneficiary_member_id is distinct from new.beneficiary_member_id
    or target.currency is distinct from claim_currency
    or not exists(select 1 from referral.member member
      where member.scope_id=new.scope_id and member.id=target.source_id
        and member.member_id=new.beneficiary_member_id)
  then raise exception 'REFERRAL_WITHDRAW_CLAIM_EVIDENCE_MISMATCH'; end if;
  return new;
end $function$;

create function referral.attach_withdrawal_claims(
  p_scope text,
  p_withdrawal text,
  p_claim_ids text[]
) returns table(claim_id text)
language plpgsql volatile security definer
set search_path=referral,finance,access,pg_temp as $function$
declare
  target finance.withdrawal%rowtype;
  expected_count integer;
  attached_count integer;
  attached_total bigint;
begin
  expected_count:=coalesce(cardinality(p_claim_ids),0);
  if p_scope is null or p_scope='' or p_withdrawal is null or p_withdrawal=''
    or expected_count=0
    or expected_count<>(select count(distinct claims.id) from unnest(p_claim_ids) as claims(id))
    or access.scope_allowed(p_scope) is not true
  then raise exception 'REFERRAL_WITHDRAW_SUBMISSION_CONFLICT'; end if;
  select withdrawal.* into target
  from finance.withdrawal withdrawal
  where withdrawal.scope_id=p_scope and withdrawal.id=p_withdrawal
    and withdrawal.source_kind='referral' and withdrawal.state='submitted'
  for update;
  if not found then raise exception 'REFERRAL_WITHDRAW_SUBMISSION_CONFLICT'; end if;

  return query
  update referral.withdrawalclaim claim set
    withdrawal_id=p_withdrawal,state='submitted',updated_at=clock_timestamp(),version=claim.version+1
  where claim.scope_id=p_scope and claim.id=any(p_claim_ids)
    and claim.state='reserved' and claim.withdrawal_id is null
  returning claim.id;
  get diagnostics attached_count=row_count;
  select coalesce(sum(claim.amount_minor),0) into attached_total
  from referral.withdrawalclaim claim
  where claim.scope_id=p_scope and claim.withdrawal_id=p_withdrawal;
  if attached_count<>expected_count or attached_total<>target.amount_minor
  then raise exception 'REFERRAL_WITHDRAW_SUBMISSION_CONFLICT'; end if;
end $function$;

create function referral.sync_withdrawal_claim_state()
returns trigger language plpgsql volatile security definer
set search_path=referral,finance,pg_temp as $function$
begin
  if new.source_kind='referral' and new.state is distinct from old.state then
    update referral.withdrawalclaim claim set
      state=new.state,
      updated_at=clock_timestamp(),
      version=claim.version+1
    where claim.scope_id=new.scope_id and claim.withdrawal_id=new.id
      and claim.state is distinct from new.state;
  end if;
  return new;
end $function$;

create function referral.has_pending_reversal(p_scope text,p_beneficiary_member text)
returns boolean language sql stable security definer
set search_path=referral,runtime,pg_temp as $function$
  select exists(
    select 1 from referral.commission commission
    join runtime.outbox outbox on outbox.scope_id=commission.scope_id
      and outbox.event_type in('order.cancelled','payment.refunded')
      and outbox.payload->>'order'=commission.order_id
    left join runtime.inbox inbox on inbox.event_id=outbox.id
      and inbox.consumer='job:referral' and inbox.event_type=outbox.event_type
    where commission.scope_id=p_scope
      and commission.beneficiary_member_id=p_beneficiary_member
      and inbox.processed_at is null
  )
$function$;

create function referral.guard_withdrawal_reversal()
returns trigger language plpgsql volatile
set search_path=referral,finance,pg_temp as $function$
declare
  claim_count bigint;
  claim_total bigint;
  invalid_claim boolean;
begin
  if tg_op='UPDATE' and (old.source_kind='referral' or new.source_kind='referral') then
    if new.id is distinct from old.id or new.scope_id is distinct from old.scope_id
      or new.settlement_id is distinct from old.settlement_id
      or new.source_kind is distinct from old.source_kind
      or new.source_id is distinct from old.source_id
      or new.beneficiary_member_id is distinct from old.beneficiary_member_id
      or new.amount_minor is distinct from old.amount_minor
      or new.currency is distinct from old.currency
      or new.destination_ref is distinct from old.destination_ref
      or new.requested_by is distinct from old.requested_by
      or new.reason is distinct from old.reason
      or new.created_at is distinct from old.created_at
    then raise exception 'REFERRAL_WITHDRAW_CLAIM_EVIDENCE_MISMATCH'; end if;
    if new.version<>old.version+1 or new.updated_at<old.updated_at
    then raise exception 'REFERRAL_WITHDRAW_CLAIM_EVIDENCE_MISMATCH'; end if;
    if old.approved_by is not null and new.approved_by is distinct from old.approved_by
    then raise exception 'REFERRAL_WITHDRAW_CLAIM_EVIDENCE_MISMATCH'; end if;
    if old.state='paid' and new.paid_at is distinct from old.paid_at
    then raise exception 'REFERRAL_WITHDRAW_CLAIM_EVIDENCE_MISMATCH'; end if;
  end if;
  if new.source_kind='referral' then
    if tg_op='INSERT' and (new.state<>'submitted' or new.version<>0
      or new.approved_by is not null or new.paid_at is not null
      or not exists(select 1 from referral.member member
        where member.scope_id=new.scope_id and member.id=new.source_id
          and member.member_id=new.beneficiary_member_id)) then
      raise exception 'REFERRAL_WITHDRAW_STATE_TRANSITION_INVALID';
    elsif tg_op='UPDATE' and new.state is distinct from old.state
      and not (
        (old.state='submitted' and new.state in('approved','rejected','cancelled'))
        or (old.state='approved' and new.state in('processing','cancelled'))
        or (old.state='processing' and new.state in('paid','failed','uncertain'))
        or (old.state='failed' and new.state in('approved','cancelled'))
        or (old.state='uncertain' and new.state in('approved','processing'))
      )
    then raise exception 'REFERRAL_WITHDRAW_STATE_TRANSITION_INVALID'; end if;
    if new.state='approved' and (new.approved_by is null or new.approved_by=new.requested_by)
    then raise exception 'REFERRAL_WITHDRAW_STATE_TRANSITION_INVALID'; end if;
    if new.state='paid' and new.paid_at is null
    then raise exception 'REFERRAL_WITHDRAW_STATE_TRANSITION_INVALID'; end if;
  end if;
  if new.source_kind='referral' and new.state in('approved','processing')
    and (tg_op='INSERT' or new.state is distinct from old.state) then
    if tg_op='INSERT'
      or (new.state='approved' and old.state not in('submitted','failed','uncertain'))
      or (new.state='processing' and old.state not in('approved','uncertain'))
    then raise exception 'REFERRAL_WITHDRAW_STATE_TRANSITION_INVALID'; end if;
    if not exists(
      select 1 from referral.member member where member.scope_id=new.scope_id
        and member.id=new.source_id and member.member_id=new.beneficiary_member_id
    ) then raise exception 'REFERRAL_WITHDRAW_CLAIM_EVIDENCE_MISMATCH'; end if;
    select count(*),coalesce(sum(claim.amount_minor),0),coalesce(bool_or(
      claim.scope_id<>new.scope_id
      or claim.beneficiary_member_id<>new.beneficiary_member_id
      or commission.currency<>new.currency
      or claim.state<>old.state
    ),true) into claim_count,claim_total,invalid_claim
    from referral.withdrawalclaim claim
    join referral.commission commission on commission.scope_id=claim.scope_id
      and commission.id=claim.commission_id
    where claim.withdrawal_id=new.id;
    if claim_count=0 or claim_total<>new.amount_minor or invalid_claim
    then raise exception 'REFERRAL_WITHDRAW_CLAIM_EVIDENCE_MISMATCH'; end if;
  end if;
  if new.source_kind='referral'
    and new.state in('approved','processing')
    and (tg_op='INSERT' or new.state is distinct from old.state)
    and not (tg_op='UPDATE' and old.state='uncertain' and new.state='processing')
    and referral.has_pending_reversal(new.scope_id,new.beneficiary_member_id)
  then raise exception 'REFERRAL_WITHDRAW_REVERSAL_PENDING'; end if;
  if new.source_kind='referral' and new.state='paid'
    and (tg_op='INSERT' or old.state<>'processing')
    and referral.has_pending_reversal(new.scope_id,new.beneficiary_member_id)
  then raise exception 'REFERRAL_WITHDRAW_REVERSAL_PENDING'; end if;
  return new;
end $function$;

create trigger referral_commissionmovement_apply
before insert on referral.commissionmovement
for each row execute function referral.apply_commission_reversal();
create trigger referral_commissionmovement_immutable
before update or delete on referral.commissionmovement
for each row execute function referral.reject_commissionmovement_mutation();
create trigger referral_recoverymovement_validate
before insert on referral.recoverymovement
for each row execute function referral.validate_recoverymovement();
create trigger referral_recoverymovement_immutable
before update or delete on referral.recoverymovement
for each row execute function referral.reject_recoverymovement_mutation();
create trigger referral_withdrawalclaim_validate
before insert on referral.withdrawalclaim
for each row execute function referral.validate_withdrawal_claim();
create trigger referral_withdrawalclaim_identity
before update on referral.withdrawalclaim
for each row execute function referral.protect_withdrawal_claim_identity();
create trigger finance_withdrawal_referral_claim_state
after update of state on finance.withdrawal
for each row execute function referral.sync_withdrawal_claim_state();
create trigger finance_withdrawal_referral_reversal_guard
before insert or update on finance.withdrawal
for each row execute function referral.guard_withdrawal_reversal();

do $rls$
declare target text;
begin
  foreach target in array array[
    'setting','product','member','binding','commission','commissionmovement','recoverymovement','withdrawalclaim'
  ] loop
    execute format('alter table referral.%I enable row level security',target);
    execute format(
      'create policy appscope on referral.%I for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id))',
      target
    );
    execute format(
      'create policy jobscope on referral.%I for all to shopjob using(true) with check(true)',
      target
    );
  end loop;
end $rls$;

grant usage on schema referral to shopapp,shopjob;
grant select,insert,update on referral.setting,referral.product,referral.member,referral.binding to shopapp,shopjob;
grant select,insert on referral.withdrawalclaim to shopapp;
grant select on referral.withdrawalclaim to shopjob;
revoke update,delete on referral.withdrawalclaim from shopapp,shopjob;
grant select on referral.commission,referral.commissionmovement,referral.recoverymovement to shopapp;
grant select,insert,update on referral.commission to shopjob;
grant select,insert on referral.commissionmovement,referral.recoverymovement to shopjob;
revoke all on function referral.bind_first_touch(text,text,text,text,timestamptz),
  referral.apply_commission_reversal(),referral.reject_commissionmovement_mutation(),
  referral.validate_recoverymovement(),referral.reject_recoverymovement_mutation(),
  referral.validate_withdrawal_claim(),referral.protect_withdrawal_claim_identity(),
  referral.attach_withdrawal_claims(text,text,text[]),
  referral.sync_withdrawal_claim_state(),referral.has_pending_reversal(text,text),
  referral.guard_withdrawal_reversal() from public,anon,authenticated,service_role;
grant execute on function referral.bind_first_touch(text,text,text,text,timestamptz),
  referral.has_pending_reversal(text,text) to shopapp,shopjob;
grant execute on function referral.attach_withdrawal_claims(text,text,text[]) to shopapp;

insert into runtime.schemaversion(version,checksum)
values('20260829105000','bb9e36a69a978f0562b67667b5b9d994dc4fd42a17d9a2caa14d24ae13daf3fb');

do $assert$
begin
  if to_regclass('referral.setting') is null
    or to_regclass('referral.product') is null
    or to_regclass('referral.member') is null
    or to_regclass('referral.binding') is null
    or to_regclass('referral.commission') is null
    or to_regclass('referral.commissionmovement') is null
    or to_regclass('referral.recoverymovement') is null
    or to_regclass('referral.withdrawalclaim') is null
    or to_regprocedure('referral.bind_first_touch(text,text,text,text,timestamp with time zone)') is null
    or to_regprocedure('referral.has_pending_reversal(text,text)') is null
  then raise exception 'REFERRAL_FOUNDATION_OBJECT_MISSING'; end if;
  if (select count(*) from pg_policies where schemaname='referral')<>16
  then raise exception 'REFERRAL_RLS_POLICY_COUNT_MISMATCH'; end if;
  if (select count(*) from finance.accountingeventrule
      where event_type in(
        'referral.commission.accrued','referral.commission.reversed',
        'referral.commission.recovery.accrued','referral.commission.recovery.offset',
        'referral.withdrawal.paid'
      ))<>5
    or position('referral.%' in pg_get_functiondef(
      'runtime.reject_financial_outbox_fact_mutation()'::regprocedure
    ))=0
    or position('order.received' in pg_get_functiondef(
      'runtime.reject_financial_inbox_fact_mutation()'::regprocedure
    ))=0
  then raise exception 'REFERRAL_FINANCIAL_EVENT_BOUNDARY_MISSING'; end if;
  if not exists(select 1 from information_schema.columns
      where table_schema='finance' and table_name='withdrawal' and column_name='source_kind')
    or not exists(select 1 from information_schema.columns
      where table_schema='finance' and table_name='withdrawal' and column_name='beneficiary_member_id')
  then raise exception 'REFERRAL_WITHDRAWAL_SOURCE_CONTRACT_MISSING'; end if;
  if has_table_privilege('shopapp','referral.commission','INSERT')
    or has_table_privilege('shopapp','referral.commission','UPDATE')
    or has_table_privilege('shopapp','referral.commission','DELETE')
    or has_table_privilege('shopapp','referral.commissionmovement','INSERT')
    or has_table_privilege('shopapp','referral.recoverymovement','INSERT')
    or has_table_privilege('shopjob','referral.commissionmovement','UPDATE')
    or has_table_privilege('shopjob','referral.commissionmovement','DELETE')
    or has_table_privilege('shopjob','referral.recoverymovement','UPDATE')
    or has_table_privilege('shopjob','referral.recoverymovement','DELETE')
  then raise exception 'REFERRAL_TABLE_PRIVILEGE_BOUNDARY_OPEN'; end if;
  if not has_table_privilege('shopapp','referral.commission','SELECT')
    or not has_table_privilege('shopjob','referral.commissionmovement','INSERT')
    or not has_table_privilege('shopjob','referral.recoverymovement','INSERT')
    or not has_function_privilege(
      'shopapp','referral.bind_first_touch(text,text,text,text,timestamp with time zone)','EXECUTE'
    )
    or not has_function_privilege('shopapp','referral.has_pending_reversal(text,text)','EXECUTE')
  then raise exception 'REFERRAL_REQUIRED_PRIVILEGE_MISSING'; end if;
  if exists(select 1 from pg_roles where rolname in('shopapp','shopjob') and rolbypassrls)
  then raise exception 'REFERRAL_ROLE_BYPASSES_RLS'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260829105000')
  then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
