begin;

select pg_advisory_xact_lock(hashtext('checkout:address-default:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260909010000'
        and checksum='cc49e9268f27438863c216dcd3773da785214db36d0c0866e49ba23da6b45cab')
    or exists(select 1 from runtime.schemaversion where version>'20260909010000') then
    raise exception 'CHECKOUT_ADDRESS_DEFAULT_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

alter table checkout.address
  add column is_default boolean not null default false;

with first_active as (
  select distinct on(member_id) member_id,id
  from checkout.address
  where status='active'
  order by member_id,id
)
update checkout.address address
set is_default=(address.id=first_active.id)
from first_active
where address.member_id=first_active.member_id and address.status='active';

create unique index checkout_address_one_active_default_per_member
  on checkout.address(member_id)
  where status='active' and is_default;

insert into runtime.schemaversion(version,checksum)
values('20260909061000','c991df2e1432618d6f39763476e8473588891269231fe01373877422e3a7c6ba');

do $assert$
begin
  if not exists(select 1 from information_schema.columns
      where table_schema='checkout' and table_name='address' and column_name='is_default'
        and is_nullable='NO')
    or exists(select member_id from checkout.address where status='active' and is_default
      group by member_id having count(*)>1)
    or exists(select member_id from checkout.address where status='active'
      group by member_id having count(*) filter(where is_default)<>1)
    or not exists(select 1 from pg_indexes where schemaname='checkout' and tablename='address'
      and indexname='checkout_address_one_active_default_per_member')
    or not exists(select 1 from runtime.schemaversion
      where version='20260909061000'
        and checksum='c991df2e1432618d6f39763476e8473588891269231fe01373877422e3a7c6ba') then
    raise exception 'CHECKOUT_ADDRESS_DEFAULT_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
