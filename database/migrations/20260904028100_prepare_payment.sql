begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904028000') then raise exception 'PAYMENT_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904028100') then raise exception 'PAYMENT_ALREADY_APPLIED'; end if;
end $precondition$;

alter table payment.intent
  add column purpose text,
  add column created_at timestamptz,
  add column updated_at timestamptz;
update payment.intent set purpose='purchase',created_at=expires_at-interval '30 minutes',updated_at=expires_at-interval '30 minutes';
alter table payment.intent
  alter column purpose set not null,
  alter column created_at set not null,
  alter column updated_at set not null,
  add constraint payment_intent_purpose check(purpose in('purchase')) not valid,
  add constraint payment_intent_period check(expires_at>created_at and updated_at>=created_at) not valid;
alter table payment.intent validate constraint payment_intent_purpose;
alter table payment.intent validate constraint payment_intent_period;
create unique index payment_intent_active_order_purpose on payment.intent(order_id,purpose)
  where state in('created','preparing','pending');

alter table payment.attempt add column sequence integer,add column idempotency_key text;
with numbered as(
  select id,row_number() over(partition by intent_id,provider order by requested_at,id)::integer sequence from payment.attempt
) update payment.attempt attempt set sequence=numbered.sequence,idempotency_key=attempt.intent_id||':'||attempt.provider||':'||numbered.sequence
from numbered where numbered.id=attempt.id;
alter table payment.attempt
  alter column sequence set not null,
  alter column idempotency_key set not null,
  add constraint payment_attempt_sequence check(sequence>0) not valid,
  add constraint payment_attempt_intent_sequence unique(intent_id,provider,sequence),
  add constraint payment_attempt_provider_idempotency unique(provider,idempotency_key);
alter table payment.attempt validate constraint payment_attempt_sequence;

alter table payment.refund add column requested_at timestamptz,add column completed_at timestamptz;
update payment.refund set requested_at=coalesce((select min(started_at) from payment.providerattempt where refund_id=payment.refund.id),clock_timestamp()),
  completed_at=case when state in('succeeded','failed','cancelled') then coalesce((select max(completed_at) from payment.providerattempt where refund_id=payment.refund.id),clock_timestamp()) end;
alter table payment.refund alter column requested_at set not null;
alter table payment.refund add constraint payment_refund_completion
  check((state in('succeeded','failed','cancelled'))=(completed_at is not null)) not valid;
alter table payment.refund validate constraint payment_refund_completion;

create function payment.guard_intent_transition() returns trigger language plpgsql
set search_path=payment,pg_temp as $function$
begin
  if old.state='failed' and new.state='preparing' and current_setting('app.operation_id',true)='payment.intents.create' then
    if new.version<>old.version+1 or new.idempotency_key=old.idempotency_key or new.expires_at<=clock_timestamp() then raise exception 'PAYMENT_INTENT_RETRY_INVALID'; end if;
    new.updated_at=clock_timestamp();
    return new;
  end if;
  if old.state in('refunded','failed','cancelled','expired') and new.state<>old.state then raise exception 'PAYMENT_INTENT_FINAL'; end if;
  if old.state='captured' and new.state not in('captured','partiallyrefunded','refunded') then raise exception 'PAYMENT_INTENT_BACKWARD'; end if;
  if old.state='partiallyrefunded' and new.state not in('partiallyrefunded','refunded') then raise exception 'PAYMENT_INTENT_BACKWARD'; end if;
  new.updated_at=clock_timestamp();
  return new;
end $function$;
create trigger paymentintenttransition before update on payment.intent for each row execute function payment.guard_intent_transition();

create function payment.guard_attempt_transition() returns trigger language plpgsql
set search_path=payment,pg_temp as $function$
begin
  if old.state in('succeeded','failed') and new.state<>old.state then raise exception 'PAYMENT_ATTEMPT_FINAL'; end if;
  return new;
end $function$;
create trigger paymentattempttransition before update on payment.attempt for each row execute function payment.guard_attempt_transition();

create function payment.guard_refund_transition() returns trigger language plpgsql
set search_path=payment,pg_temp as $function$
begin
  if old.state='failed' and new.state='requested' and current_setting('app.operation_id',true)='payment.recoveries.resolve' then return new; end if;
  if old.state in('succeeded','failed','cancelled') and new.state<>old.state then raise exception 'PAYMENT_REFUND_FINAL'; end if;
  return new;
end $function$;
create trigger paymentrefundtransition before update on payment.refund for each row execute function payment.guard_refund_transition();

create index payment_attempt_intent_recent on payment.attempt(intent_id,provider,sequence desc) include(state,scene,application_hash);
create index payment_refund_state_time on payment.refund(state,requested_at,id) include(payment_id,amount_minor,currency);

do $security$ declare item record; begin
  for item in select unnest(array['intent','attempt','intenttender','action','observation','payment','capture','allocation','refund','refundtender','recoverycase','recoveryrequest']) name loop
    execute format('alter table payment.%I force row level security',item.name);
  end loop;
end $security$;

insert into runtime.operation(id,owner,method,path,contract_version)
values('payment.intents.create','payment','POST','/api/v1/payments/intents','5.0.0');
insert into access.permission(id,code,risk,status)
values('permission:paymentcreatev5','payment.create','elevated','active');
insert into capability.capability(id,kind,name,version,status)
values('payment.intents.create','operation','payment.intents.create',3,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience,targets)
values('payment.intents.create','payment.intents.create','payment.create','storefront','{storefront,miniapp}');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
values('platform:payment.intents.create','organization-platform-root','payment.intents.create','enabled',null,'1970-01-01T00:00:00Z',null,0);
insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow' from access.role role cross join access.permission permission
where role.id in('role-platform-owner-v2','role:self') and permission.code='payment.create' on conflict do nothing;

alter table runtime.errorcontract disable row level security;
insert into runtime.errorcontract(code,status,retryable,audit,client,contract_version) values
  ('PAYMENT_ALLOCATION_UNBALANCED',400,false,true,'message','5.0.0'),
  ('PAYMENT_INTENT_CONFLICT',409,false,true,'message','5.0.0'),
  ('PAYMENT_INTENT_NOT_PAYABLE',409,false,true,'message','5.0.0')
on conflict(code) do update set status=excluded.status,retryable=excluded.retryable,audit=excluded.audit,client=excluded.client,contract_version=excluded.contract_version;
alter table runtime.errorcontract enable row level security;

update runtime.operation set contract_version='5.0.0' where owner='payment';
update capability.capability set version=version+1 where id in(select id from runtime.operation where owner='payment');
update runtime.contractcatalog set checksum='e29fd1ba5c13d9319c7cfd4f461b2ed29d643887c2e70f0c7ecb44a50d9b35c4',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event where retired_at is null),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260904028100',(select count(*) from payment.intent),(select count(*) from payment.intent),0,0,
  'select purpose,state,count(*) from payment.intent group by purpose,state;',
  'select state,count(*),sum(amount_minor) amount_minor from payment.refund group by state;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904028100',encode(public.digest('20260904028100_prepare_payment','sha256'),'hex'));

do $assert$ begin
  if exists(select order_id,purpose from payment.intent where state in('created','preparing','pending') group by order_id,purpose having count(*)>1)
    then raise exception 'PAYMENT_ACTIVE_INTENT_DUPLICATE'; end if;
  if exists(select 1 from payment.attempt where sequence<=0 or idempotency_key='') then raise exception 'PAYMENT_ATTEMPT_IDEMPOTENCY_INVALID'; end if;
  if not exists(select 1 from runtime.operation where id='payment.intents.create') then raise exception 'PAYMENT_INTENT_CREATE_OPERATION_MISSING'; end if;
  if (select count(*) from runtime.operation)<>318 then raise exception 'PAYMENT_OPERATION_COUNT_INVALID'; end if;
  if (select count(*) from runtime.event where retired_at is null)<>144 then raise exception 'PAYMENT_EVENT_COUNT_INVALID'; end if;
end $assert$;

commit;
