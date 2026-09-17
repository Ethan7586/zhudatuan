create extension if not exists pgcrypto;
create role zhudatuanidentityapi;
create schema ordering;
create schema runtime;
create table runtime.schemaversion(version text primary key,checksum text not null);
create table ordering.orderrecord(
  id text,order_number text,member_id text,mall_id text,total_minor bigint,currency text,
  payment_state text,fulfillment_state text,aftersale_state text,created_at timestamptz,
  evidence jsonb
);
alter table ordering.orderrecord enable row level security;
insert into ordering.orderrecord(id,order_number,member_id,mall_id,created_at)
values('order:a','A','member:a','mall:a',now()),('order:b','B','member:b','mall:b',now());

\ir ../migrations/20260917100000_restore_storefront_member_order_read.sql

set role zhudatuanidentityapi;
set app.scope_id='mall:a';
do $test$
begin
  perform id,order_number,member_id,mall_id,total_minor,currency,payment_state,
    fulfillment_state,aftersale_state,created_at from ordering.orderrecord;
  if (select count(*) from ordering.orderrecord)<>1
    or (select max(order_number) from ordering.orderrecord)<>'A'
    or has_column_privilege(current_user,'ordering.orderrecord','evidence','select')
    or has_table_privilege(current_user,'ordering.orderrecord','update') then
    raise exception 'MEMBER_ORDER_READ_SCOPE_A_INVALID';
  end if;
end $test$;
set app.scope_id='mall:b';
do $test$
begin
  if (select count(*) from ordering.orderrecord)<>1
    or (select max(order_number) from ordering.orderrecord)<>'B' then
    raise exception 'MEMBER_ORDER_READ_SCOPE_B_INVALID';
  end if;
end $test$;
reset app.scope_id;
do $test$
begin
  if (select count(*) from ordering.orderrecord)<>0 then
    raise exception 'MEMBER_ORDER_READ_WITHOUT_SCOPE';
  end if;
end $test$;
