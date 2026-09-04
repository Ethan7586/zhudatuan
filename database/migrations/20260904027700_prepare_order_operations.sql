begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904027600') then raise exception 'ORDER_OPERATION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904027700') then raise exception 'ORDER_OPERATION_ALREADY_APPLIED'; end if;
end $precondition$;

alter table ordering.paymentread add column version bigint not null default 0;
update ordering.paymentread projection set version=payment.version
from payment.payment payment where payment.id=projection.payment_id;
alter table ordering.paymentread add constraint order_paymentread_version check(version>=0) not valid;
alter table ordering.paymentread validate constraint order_paymentread_version;

alter table payment.recoverycase add column version bigint not null default 0;
alter table payment.recoverycase add constraint payment_recovery_version check(version>=0) not valid;
alter table payment.recoverycase validate constraint payment_recovery_version;
create index payment_recovery_order on payment.recoverycase(scope_id,order_id,opened_at desc,id desc) where order_id is not null;

comment on column ordering.paymentread.version is 'Payment aggregate version copied through the Order-owned projection for optimistic commands.';
comment on column payment.recoverycase.version is 'Monotonic recovery aggregate version used by operator resolutions.';

select runtime.record_migration_evidence(
  '20260904027700',(select count(*) from ordering.paymentread),(select count(*) from ordering.paymentread),0,0,
  'create index concurrently if not exists payment_recovery_open_order on payment.recoverycase(scope_id,order_id,opened_at desc,id desc) where state=''open'' and order_id is not null;',
  'select state,count(*) from payment.recoverycase group by state;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904027700',encode(public.digest('20260904027700_prepare_order_operations','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from ordering.paymentread projection join payment.payment payment on payment.id=projection.payment_id
    where projection.version<>payment.version) then raise exception 'ORDER_PAYMENT_VERSION_BACKFILL_INVALID'; end if;
  if exists(select 1 from payment.recoverycase where version<0) then raise exception 'PAYMENT_RECOVERY_VERSION_INVALID'; end if;
  if not exists(select 1 from pg_indexes where schemaname='payment' and indexname='payment_recovery_order')
    then raise exception 'PAYMENT_RECOVERY_ORDER_INDEX_MISSING'; end if;
end $assert$;

commit;
