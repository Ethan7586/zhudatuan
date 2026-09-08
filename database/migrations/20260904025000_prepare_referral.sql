begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904024000') then raise exception 'REFERRAL_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904025000') then raise exception 'REFERRAL_ALREADY_APPLIED'; end if;
end $precondition$;

alter table referral.setting add column freeze_days integer not null default 7;
alter table referral.setting add column reward_enabled boolean not null default false;
alter table referral.setting add column recruit_enabled boolean not null default false;
alter table referral.setting add column review_required boolean not null default true;
alter table referral.setting add column binding_mode text not null default 'days';
alter table referral.setting add column settlement_trigger text not null default 'received';
alter table referral.setting add column monthly_withdrawal_limit integer;
alter table referral.setting drop constraint setting_first_touch_days_check;
alter table referral.setting drop constraint setting_minimum_withdrawal_minor_check;
alter table referral.setting add constraint referral_setting_touch check(first_touch_days between 1 and 3650) not valid;
alter table referral.setting add constraint referral_setting_minimum check(minimum_withdrawal_minor>=0) not valid;
alter table referral.setting add constraint referral_setting_freeze check(freeze_days between 0 and 3650) not valid;
alter table referral.setting add constraint referral_setting_binding_mode check(binding_mode in('permanent','days')) not valid;
alter table referral.setting add constraint referral_setting_settlement_trigger check(settlement_trigger in('paid','received')) not valid;
alter table referral.setting add constraint referral_setting_monthly_withdrawal check(monthly_withdrawal_limit is null or monthly_withdrawal_limit between 1 and 1000) not valid;
alter table referral.setting validate constraint referral_setting_touch;
alter table referral.setting validate constraint referral_setting_minimum;
alter table referral.setting validate constraint referral_setting_freeze;
alter table referral.setting validate constraint referral_setting_binding_mode;
alter table referral.setting validate constraint referral_setting_settlement_trigger;
alter table referral.setting validate constraint referral_setting_monthly_withdrawal;

alter table referral.binding add column promoter_member_id text;
alter table referral.binding add column expires_at timestamptz;
alter table referral.binding add column state text not null default 'active';
alter table referral.binding add column superseded_at timestamptz;
update referral.binding binding set promoter_member_id=member.member_id,
  expires_at=binding.bound_at+make_interval(days=>setting.first_touch_days)
from referral.member member join referral.setting setting on setting.scope_id=member.scope_id
where member.id=binding.promoter_id and member.scope_id=binding.scope_id;
update referral.binding set source='storefront' where source not in('storefront','miniapp','checkout');
alter table referral.binding alter column promoter_member_id set not null;
alter table referral.binding drop constraint binding_scope_id_customer_id_key;
alter table referral.binding drop constraint binding_token_fingerprint_key;
alter table referral.binding drop constraint binding_check;
alter table referral.binding add constraint referral_binding_source check(source in('storefront','miniapp','checkout')) not valid;
alter table referral.binding add constraint referral_binding_state check(state in('active','superseded')) not valid;
alter table referral.binding add constraint referral_binding_period check(expires_at is null or expires_at>bound_at) not valid;
alter table referral.binding add constraint referral_binding_self check(customer_id<>promoter_member_id) not valid;
alter table referral.binding add constraint referral_binding_lifecycle check(
  (state='active' and superseded_at is null) or (state='superseded' and superseded_at is not null and superseded_at>=bound_at)
) not valid;
alter table referral.binding validate constraint referral_binding_source;
alter table referral.binding validate constraint referral_binding_state;
alter table referral.binding validate constraint referral_binding_period;
alter table referral.binding validate constraint referral_binding_self;
alter table referral.binding validate constraint referral_binding_lifecycle;
create unique index referral_binding_active_customer on referral.binding(scope_id,customer_id) where state='active';
create index referral_binding_token on referral.binding(scope_id,token_fingerprint);
create index referral_binding_attribution on referral.binding(scope_id,customer_id,bound_at desc,id desc) include(promoter_id,promoter_member_id,expires_at,state,version);

alter table referral.product add column reward_basis_points integer not null default 0;
alter table referral.product add constraint referral_product_reward_rate check(reward_basis_points between 0 and 10000) not valid;
alter table referral.product add constraint referral_product_total_rate check(rate_basis_points+reward_basis_points<=10000) not valid;
alter table referral.product validate constraint referral_product_reward_rate;
alter table referral.product validate constraint referral_product_total_rate;

alter table referral.commission add column binding_id text;
alter table referral.commission add column kind text not null default 'commission';
alter table referral.commission add column rule_id text;
alter table referral.commission add column rule_version bigint;
alter table referral.commission add column rule_snapshot jsonb;
alter table referral.commission add column setting_version bigint;
alter table referral.commission add column origin_event_version integer;
update referral.commission commission set
  binding_id=coalesce((select binding.id from referral.binding binding join referral.member member on member.id=binding.promoter_id
    where binding.scope_id=commission.scope_id and member.member_id=commission.beneficiary_id order by binding.bound_at desc,binding.id desc limit 1),
    'referralbinding:legacy:'||substr(encode(public.digest(commission.id,'sha256'),'hex'),1,32)),
  rule_id=coalesce((select product.id from referral.product product where product.scope_id=commission.scope_id and product.product_id=commission.product_id),
    'referralproduct:legacy:'||substr(encode(public.digest(commission.product_id,'sha256'),'hex'),1,32)),
  rule_version=coalesce((select product.version from referral.product product where product.scope_id=commission.scope_id and product.product_id=commission.product_id),1),
  setting_version=coalesce((select setting.version from referral.setting setting where setting.scope_id=commission.scope_id),1),
  origin_event_version=1;
update referral.commission set rule_snapshot=jsonb_build_object(
  'productId',product_id,'kind',kind,'rateBasisPoints',rate_basis_points,
  'commissionBasisPoints',rate_basis_points,'rewardBasisPoints',0,'rewardEnabled',false,
  'settlementTrigger','received','freezeDays',7,
  'productVersion',rule_version,'settingVersion',setting_version
);
alter table referral.commission alter column binding_id set not null;
alter table referral.commission alter column rule_id set not null;
alter table referral.commission alter column rule_version set not null;
alter table referral.commission alter column rule_snapshot set not null;
alter table referral.commission alter column setting_version set not null;
alter table referral.commission alter column origin_event_version set not null;
alter table referral.commission drop constraint commission_scope_id_order_line_id_beneficiary_id_key;
alter table referral.commission add constraint referral_commission_kind check(kind in('commission','reward')) not valid;
alter table referral.commission add constraint referral_commission_rule_version check(rule_version>0 and setting_version>0 and origin_event_version>0) not valid;
alter table referral.commission add constraint referral_commission_snapshot check(
  jsonb_typeof(rule_snapshot)='object' and rule_snapshot->>'productId'=product_id
  and rule_snapshot->>'kind'=kind
  and (rule_snapshot->>'rateBasisPoints')::integer=rate_basis_points
  and (rule_snapshot->>'commissionBasisPoints')::integer between 0 and 10000
  and (rule_snapshot->>'rewardBasisPoints')::integer between 0 and 10000
  and (rule_snapshot->>'commissionBasisPoints')::integer+(rule_snapshot->>'rewardBasisPoints')::integer<=10000
  and jsonb_typeof(rule_snapshot->'rewardEnabled')='boolean'
  and rule_snapshot->>'settlementTrigger' in('paid','received')
  and (rule_snapshot->>'freezeDays')::integer between 0 and 3650
  and (rule_snapshot->>'productVersion')::bigint=rule_version
  and (rule_snapshot->>'settingVersion')::bigint=setting_version
) not valid;
alter table referral.commission validate constraint referral_commission_kind;
alter table referral.commission validate constraint referral_commission_rule_version;
alter table referral.commission validate constraint referral_commission_snapshot;
create unique index referral_commission_line_rule on referral.commission(scope_id,order_line_id,rule_id,rule_version,kind);

alter table referral.withdrawalclaim add column approval_instance_id text;
alter table referral.withdrawalclaim add column approval_proof_id text;
alter table referral.withdrawalclaim add column approved_at timestamptz;
update referral.withdrawalclaim set approval_instance_id='approvalinstance:legacy:'||substr(encode(public.digest(id,'sha256'),'hex'),1,32),
  approved_at=case when state='paid' then requested_at else null end;
update referral.withdrawalclaim set state='failed',completed_at=clock_timestamp(),
  failure_reason='历史提现缺少审批证据，已终止并释放占用余额'
where state in('requested','processing');
alter table referral.withdrawalclaim alter column approval_instance_id set not null;
alter table referral.withdrawalclaim drop constraint withdrawalclaim_check;
alter table referral.withdrawalclaim add constraint referral_withdrawal_lifecycle check(
  (state='requested' and approved_at is null and approval_proof_id is null and completed_at is null and failure_reason is null)
  or (state='processing' and approved_at is not null and approval_proof_id is not null and completed_at is null and failure_reason is null)
  or (state='paid' and approved_at is not null and completed_at is not null and provider_reference is not null and failure_reason is null)
  or (state='failed' and completed_at is not null and failure_reason is not null)
) not valid;
alter table referral.withdrawalclaim validate constraint referral_withdrawal_lifecycle;
drop index referral.referral_withdrawal_due;
create index referral_withdrawal_due on referral.withdrawalclaim(scope_id,approved_at,id) include(member_id,amount_minor,currency,version) where state='processing';

create table referral.settlementreceipt(
  id text primary key check(id~'^referralsettlementreceipt:'),
  scope_id text not null,
  source_type text not null check(source_type in('commission','withdrawal')),
  source_id text not null,
  source_version bigint not null check(source_version>0),
  outcome text not null check(outcome in('skipped','failed','succeeded')),
  reference text,
  error_code text,
  attempts integer not null check(attempts>0),
  observed_at timestamptz not null,
  unique(scope_id,source_type,source_id,source_version,outcome),
  check((outcome='succeeded' and reference is not null and error_code is null)
    or (outcome='failed' and reference is null and error_code is not null)
    or (outcome='skipped' and reference is null and error_code is null))
);
create index referral_settlementreceipt_source on referral.settlementreceipt(scope_id,source_type,source_id,observed_at desc,id);
alter table referral.settlementreceipt enable row level security;
alter table referral.settlementreceipt force row level security;
create policy appscope on referral.settlementreceipt for select to shopapp using(access.scope_allowed(scope_id));
create policy jobscope on referral.settlementreceipt for all to shopjob using(true) with check(true);
grant select on referral.settlementreceipt to shopapp;
grant select,insert,update on referral.settlementreceipt to shopjob;

create function referral.guard_binding() returns trigger language plpgsql security definer
set search_path=referral,pg_temp set row_security=off as $function$
begin
  if tg_op='INSERT' then
    if new.state<>'active' or new.version<>1 then raise exception 'REFERRAL_BINDING_INITIAL_STATE_INVALID'; end if;
    return new;
  end if;
  if (new.id,new.scope_id,new.customer_id,new.promoter_id,new.promoter_member_id,new.token_fingerprint,new.source,new.bound_at,new.expires_at)
    is distinct from (old.id,old.scope_id,old.customer_id,old.promoter_id,old.promoter_member_id,old.token_fingerprint,old.source,old.bound_at,old.expires_at)
    then raise exception 'REFERRAL_BINDING_ATTRIBUTION_IMMUTABLE'; end if;
  if old.state='superseded' or new.state<>'superseded' or new.version<>old.version+1 then raise exception 'REFERRAL_BINDING_TRANSITION_INVALID'; end if;
  return new;
end
$function$;
create trigger referralbindingguard before insert or update on referral.binding for each row execute function referral.guard_binding();

create function referral.guard_commission() returns trigger language plpgsql security definer
set search_path=referral,pg_temp set row_security=off as $function$
begin
  if tg_op='INSERT' then
    if new.state<>'pending' or new.version<>1 or new.refunded_base_minor<>0 or new.reversed_minor<>0 then raise exception 'REFERRAL_COMMISSION_INITIAL_STATE_INVALID'; end if;
    return new;
  end if;
  if (new.id,new.business_key,new.scope_id,new.order_id,new.order_line_id,new.product_id,new.beneficiary_id,new.binding_id,new.kind,
    new.rule_id,new.rule_version,new.rule_snapshot,new.setting_version,new.base_minor,new.amount_minor,new.rate_basis_points,
    new.currency,new.origin_event_id,new.origin_event_version,new.created_at)
    is distinct from (old.id,old.business_key,old.scope_id,old.order_id,old.order_line_id,old.product_id,old.beneficiary_id,old.binding_id,old.kind,
    old.rule_id,old.rule_version,old.rule_snapshot,old.setting_version,old.base_minor,old.amount_minor,old.rate_basis_points,
    old.currency,old.origin_event_id,old.origin_event_version,old.created_at) then raise exception 'REFERRAL_COMMISSION_EVIDENCE_IMMUTABLE'; end if;
  if new.version<>old.version+1 then raise exception 'REFERRAL_COMMISSION_VERSION_CONFLICT'; end if;
  if old.state='pending' and new.state not in('pending','available','reversed') then raise exception 'REFERRAL_COMMISSION_TRANSITION_INVALID'; end if;
  if old.state='available' and new.state not in('available','settled','reversed') then raise exception 'REFERRAL_COMMISSION_TRANSITION_INVALID'; end if;
  if old.state='settled' and new.state not in('settled','reversed') then raise exception 'REFERRAL_COMMISSION_TRANSITION_INVALID'; end if;
  if old.state='reversed' and new is distinct from old then raise exception 'REFERRAL_COMMISSION_FINAL'; end if;
  return new;
end
$function$;
create trigger referralcommissionguard before insert or update on referral.commission for each row execute function referral.guard_commission();
revoke all on function referral.guard_binding(),referral.guard_commission() from public;

update runtime.operation set contract_version='5.0.0' where owner='referral';
update capability.capability set version=version+1 where id in(select id from runtime.operation where owner='referral');

update runtime.contractcatalog set checksum='312260ead9f0c459ed2c38623d8310de8b3ef3260c313d098302fb50015e7df0',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event where retired_at is null),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260904025000',(select count(*) from referral.binding),(select count(*) from referral.binding),0,0,
  'create index concurrently if not exists referral_commission_due_live on referral.commission(scope_id,eligible_at,id) include(beneficiary_id,amount_minor,reversed_minor,version) where state=''available'';',
  'select outcome,count(*) from referral.settlementreceipt group by outcome;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904025000',encode(public.digest('20260904025000_prepare_referral','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from referral.binding where (expires_at is not null and expires_at<=bound_at) or customer_id=promoter_member_id) then raise exception 'REFERRAL_BINDING_INVARIANT_INVALID'; end if;
  if exists(select 1 from referral.commission where rule_version<1 or setting_version<1 or origin_event_version<>1
    or kind not in('commission','reward') or jsonb_typeof(rule_snapshot)<>'object') then raise exception 'REFERRAL_COMMISSION_INVARIANT_INVALID'; end if;
  if exists(select 1 from referral.withdrawalclaim where state='processing' and (approved_at is null or approval_proof_id is null)) then raise exception 'REFERRAL_WITHDRAWAL_APPROVAL_INVALID'; end if;
  if (select count(*) from runtime.operation)<>312 then raise exception 'REFERRAL_OPERATION_COUNT_INVALID'; end if;
  if (select count(*) from runtime.event where retired_at is null)<>143 then raise exception 'REFERRAL_EVENT_COUNT_INVALID'; end if;
end $assert$;

commit;
