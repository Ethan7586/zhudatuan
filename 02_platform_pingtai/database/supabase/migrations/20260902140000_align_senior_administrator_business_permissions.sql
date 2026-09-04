begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:senior-administrator-business-permissions:v1'));

do $precondition$
declare
  approved_codes text[] := array[
    'benefit.read','cart.manage','cart.read','catalog.listing.read','checkout.create','fulfillment.read',
    'identity.assurance.manage','identity.credential.manage','identity.mobile.manage','identity.session.manage','identity.session.read',
    'inventory.read','member.address.manage','member.address.read','member.profile.read',
    'notification.endpoint.manage','notification.preference.manage','notification.preference.read','notification.read',
    'observability.clienterror.create','order.aftersale.apply','order.aftersale.read','order.create','order.read',
    'order.reminder.create','payment.create','pricing.offer.read','referral.self.manage','referral.self.read',
    'referral.withdrawals.create','support.case.create','voucher.binding.read','voucher.redemption.read'
  ];
begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260902139000'
      and checksum='88da0a2cc8f0b8c11bdf81996e0e0786bea199d762c174ca12dbd4c6c7924c69')
    or exists(select 1 from runtime.schemaversion where version>'20260902139000') then
    raise exception 'SENIOR_ADMINISTRATOR_BUSINESS_PERMISSION_PREDECESSOR_INVALID';
  end if;
  if exists(
    select 1
    from organization.organization tenant
    left join access.role role
      on role.id='role-senior-administrator-v1:'||tenant.id
      and role.scope_id=tenant.id and role.status='active'
    where tenant.kind='tenant' and tenant.status='active' and role.id is null
  ) then
    raise exception 'SENIOR_ADMINISTRATOR_ROLE_MISSING';
  end if;
  if (
    select count(distinct permission.code)
    from access.permission permission
    join access.rolepermission owner_mapping
      on owner_mapping.role_id='role-platform-owner-v2'
      and owner_mapping.permission_id=permission.id and owner_mapping.effect='allow'
    where permission.status='active' and permission.code=any(approved_codes)
  )<>cardinality(approved_codes) then
    raise exception 'SENIOR_ADMINISTRATOR_OWNER_BUSINESS_BASELINE_INVALID';
  end if;
end
$precondition$;

with approved(code) as (
  values
    ('benefit.read'),('cart.manage'),('cart.read'),('catalog.listing.read'),('checkout.create'),('fulfillment.read'),
    ('identity.assurance.manage'),('identity.credential.manage'),('identity.mobile.manage'),('identity.session.manage'),('identity.session.read'),
    ('inventory.read'),('member.address.manage'),('member.address.read'),('member.profile.read'),
    ('notification.endpoint.manage'),('notification.preference.manage'),('notification.preference.read'),('notification.read'),
    ('observability.clienterror.create'),('order.aftersale.apply'),('order.aftersale.read'),('order.create'),('order.read'),
    ('order.reminder.create'),('payment.create'),('pricing.offer.read'),('referral.self.manage'),('referral.self.read'),
    ('referral.withdrawals.create'),('support.case.create'),('voucher.binding.read'),('voucher.redemption.read')
), affected as (
  select distinct role.id
  from access.role role
  cross join approved
  join access.permission permission on permission.code=approved.code and permission.status='active'
  where role.id='role-senior-administrator-v1:'||role.scope_id
    and not exists(
      select 1 from access.rolepermission mapping
      where mapping.role_id=role.id and mapping.permission_id=permission.id and mapping.effect='allow'
    )
)
update access.role role
set version=role.version+1
from affected
where role.id=affected.id;

with approved(code) as (
  values
    ('benefit.read'),('cart.manage'),('cart.read'),('catalog.listing.read'),('checkout.create'),('fulfillment.read'),
    ('identity.assurance.manage'),('identity.credential.manage'),('identity.mobile.manage'),('identity.session.manage'),('identity.session.read'),
    ('inventory.read'),('member.address.manage'),('member.address.read'),('member.profile.read'),
    ('notification.endpoint.manage'),('notification.preference.manage'),('notification.preference.read'),('notification.read'),
    ('observability.clienterror.create'),('order.aftersale.apply'),('order.aftersale.read'),('order.create'),('order.read'),
    ('order.reminder.create'),('payment.create'),('pricing.offer.read'),('referral.self.manage'),('referral.self.read'),
    ('referral.withdrawals.create'),('support.case.create'),('voucher.binding.read'),('voucher.redemption.read')
)
delete from access.rolepermission mapping
using access.role role,access.permission permission,approved
where mapping.role_id=role.id
  and role.id='role-senior-administrator-v1:'||role.scope_id
  and permission.code=approved.code and permission.id=mapping.permission_id
  and mapping.effect='deny';

with approved(code) as (
  values
    ('benefit.read'),('cart.manage'),('cart.read'),('catalog.listing.read'),('checkout.create'),('fulfillment.read'),
    ('identity.assurance.manage'),('identity.credential.manage'),('identity.mobile.manage'),('identity.session.manage'),('identity.session.read'),
    ('inventory.read'),('member.address.manage'),('member.address.read'),('member.profile.read'),
    ('notification.endpoint.manage'),('notification.preference.manage'),('notification.preference.read'),('notification.read'),
    ('observability.clienterror.create'),('order.aftersale.apply'),('order.aftersale.read'),('order.create'),('order.read'),
    ('order.reminder.create'),('payment.create'),('pricing.offer.read'),('referral.self.manage'),('referral.self.read'),
    ('referral.withdrawals.create'),('support.case.create'),('voucher.binding.read'),('voucher.redemption.read')
)
insert into access.rolepermission(role_id,permission_id,effect)
select distinct role.id,permission.id,'allow'
from access.role role
cross join approved
join access.permission permission on permission.code=approved.code and permission.status='active'
join access.rolepermission owner_mapping
  on owner_mapping.role_id='role-platform-owner-v2'
  and owner_mapping.permission_id=permission.id and owner_mapping.effect='allow'
where role.id='role-senior-administrator-v1:'||role.scope_id
on conflict do nothing;

do $assert$
declare
  owner_only_codes text[] := array[
    'access.ownership.accept','access.ownership.read','access.ownership.transfer',
    'access.role.manage','access.scope.manage','capability.assignment.manage','identity.registration.reset'
  ];
begin
  if exists(
    select 1
    from access.role role
    cross join access.rolepermission owner_mapping
    join access.permission permission
      on permission.id=owner_mapping.permission_id and permission.status='active'
    where role.id='role-senior-administrator-v1:'||role.scope_id
      and owner_mapping.role_id='role-platform-owner-v2' and owner_mapping.effect='allow'
      and permission.code<>all(owner_only_codes)
      and not exists(
        select 1 from access.rolepermission senior_mapping
        where senior_mapping.role_id=role.id
          and senior_mapping.permission_id=owner_mapping.permission_id
          and senior_mapping.effect='allow'
      )
  ) then
    raise exception 'SENIOR_ADMINISTRATOR_BUSINESS_PERMISSION_MISSING';
  end if;
  if exists(
    select 1
    from access.role role
    join access.rolepermission senior_mapping on senior_mapping.role_id=role.id
    join access.permission permission on permission.id=senior_mapping.permission_id
    where role.id='role-senior-administrator-v1:'||role.scope_id
      and senior_mapping.effect='allow' and permission.code=any(owner_only_codes)
  ) then
    raise exception 'SENIOR_ADMINISTRATOR_OWNER_PERMISSION_LEAK';
  end if;
  if exists(
    select 1
    from access.role role
    join access.rolepermission senior_mapping on senior_mapping.role_id=role.id and senior_mapping.effect='allow'
    where role.id='role-senior-administrator-v1:'||role.scope_id
      and not exists(
        select 1 from access.rolepermission owner_mapping
        where owner_mapping.role_id='role-platform-owner-v2'
          and owner_mapping.permission_id=senior_mapping.permission_id
          and owner_mapping.effect='allow'
      )
  ) then
    raise exception 'SENIOR_ADMINISTRATOR_NON_OWNER_PERMISSION_INVALID';
  end if;
end
$assert$;

insert into runtime.schemaversion(version,checksum)
values('20260902140000','c9b806ab9e1b9cae7736452e62aa459cfbc347ae4dadf05c902de6919d042274');

commit;
