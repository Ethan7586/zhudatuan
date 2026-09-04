begin;

do $$
begin
  if not exists(select 1 from pg_roles where rolname='shopapp') then create role shopapp nologin; end if;
  if not exists(select 1 from pg_roles where rolname='shopjob') then create role shopjob nologin; end if;
  if not exists(select 1 from pg_roles where rolname='shopmigration') then create role shopmigration nologin; end if;
  if not exists(select 1 from pg_roles where rolname='shopread') then create role shopread nologin; end if;
end $$;

create schema if not exists identity;
create schema if not exists organization;
create schema if not exists access;
create schema if not exists capability;
create schema if not exists partner;
create schema if not exists member;
create schema if not exists qualification;
create schema if not exists catalog;
create schema if not exists pricing;
create schema if not exists inventory;
create schema if not exists experience;
create schema if not exists marketing;
create schema if not exists cart;
create schema if not exists checkout;
create schema if not exists ordering;
create schema if not exists fulfillment;
create schema if not exists verification;
create schema if not exists payment;
create schema if not exists voucher;
create schema if not exists benefit;
create schema if not exists finance;
create schema if not exists invoice;
create schema if not exists channel;
create schema if not exists support;
create schema if not exists notification;
create schema if not exists reporting;
create schema if not exists risk;
create schema if not exists audit;
create schema if not exists extension;
create schema if not exists runtime;

revoke all on schema public from public;
revoke create on schema public from public,anon,authenticated,service_role;

commit;
