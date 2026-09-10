begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:registration-bootstrap-runtime-repair:v1'));

do $boundary_guard$
begin
  if not (
    current_user='shopmigration'
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)
  ) then
    raise exception 'ZHUDATUAN_REGISTRATION_BOOTSTRAP_REPAIR_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260828183000'
      and checksum='dea267e01bc8905433242ae5cb026948750587749c5178a59ba5d08a18e0d0b8') then
    raise exception 'ZHUDATUAN_REGISTRATION_BOOTSTRAP_REPAIR_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion
    where version>'20260828183000'
      and version not in('20260828190000','20260829040000')) then
    raise exception 'ZHUDATUAN_REGISTRATION_BOOTSTRAP_REPAIR_FUTURE_HEAD_INVALID';
  end if;
end
$boundary_guard$;

-- BootstrapRegistration verifies that no inherited storefront assignment or
-- invitation can leak into 主打团. BootstrapOwner verifies that the one fixed
-- operator identity is absent or already canonical. The one-shot role gets
-- only the reads needed by those preflights. All identity/access writes remain
-- behind the SECURITY DEFINER owner function established by 20260828170000.
grant select on identity.principal,access.membership,access.membershiprole to zhudatuanbootstrap;

drop policy if exists zhudatuanbootstrapowner on identity.principal;
create policy zhudatuanbootstrapowner on identity.principal for select to zhudatuanbootstrap
  using(id='principal:zhudatuan:owner:ethan:v1');

drop policy if exists zhudatuanbootstrap on access.membership;
create policy zhudatuanbootstrap on access.membership for select to zhudatuanbootstrap
  using(
    id='membership-platform-owner-ethan-v1'
    or organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')
  );

drop policy if exists zhudatuanbootstrap on access.membershiprole;
create policy zhudatuanbootstrap on access.membershiprole for select to zhudatuanbootstrap
  using(
    role_id='role-zhudatuan-storefront-member'
    and exists(select 1 from access.membership membership
      where membership.id=membership_id
        and membership.organization_id in('tenant-smart-wing','enterprise-demo','mall-demo'))
  );

drop policy if exists zhudatuanbootstrap on access.role;
create policy zhudatuanbootstrap on access.role for select to zhudatuanbootstrap
  using(id in('role-zhudatuan-storefront-member','role:self','role-platform-owner-v2'));

drop policy if exists zhudatuanbootstrap on member.invite;
create policy zhudatuanbootstrap on member.invite for select to zhudatuanbootstrap
  using(
    (organization_id='mall-zhudatuan' and role_id='role-zhudatuan-storefront-member')
    or id='invite-demo-employee-2026'
    or organization_id in('tenant-smart-wing','enterprise-demo','mall-demo')
  );

insert into runtime.schemaversion(version,checksum)
values('20260829040000','77166f2dd111907cdf0910060362a3144e86a0606c884a3d77c8134b0743173a')
on conflict(version) do nothing;

do $assert$
begin
  if exists(select 1 from (values
      ('identity.principal'),('access.membership'),('access.membershiprole')
    ) required(relation_name)
    where not has_table_privilege('zhudatuanbootstrap',required.relation_name,'SELECT')
      or has_table_privilege('zhudatuanbootstrap',required.relation_name,
        'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) then
    raise exception 'ZHUDATUAN_BOOTSTRAP_ACCESS_PRIVILEGE_INVALID';
  end if;
  if not has_table_privilege('zhudatuanbootstrap','member.invite','SELECT,INSERT')
    or has_table_privilege('zhudatuanbootstrap','member.invite','UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'ZHUDATUAN_BOOTSTRAP_INVITE_PRIVILEGE_INVALID';
  end if;
  if exists(select 1 from (values
      ('identity','principal'),('access','membership'),('access','membershiprole'),
      ('access','role'),('member','invite')
    ) required(schema_name,table_name)
    where not exists(select 1 from pg_class relation
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname=required.schema_name and relation.relname=required.table_name
        and relation.relrowsecurity)) then
    raise exception 'ZHUDATUAN_BOOTSTRAP_ACCESS_RLS_DISABLED';
  end if;
  if (select count(*) from pg_policies where
      (schemaname='identity' and tablename='principal' and policyname='zhudatuanbootstrapowner' and cmd='SELECT')
      or (schemaname='access' and tablename in('membership','membershiprole','role') and policyname='zhudatuanbootstrap' and cmd='SELECT')
      or (schemaname='member' and tablename='invite' and policyname='zhudatuanbootstrap' and cmd='SELECT'))<>5 then
    raise exception 'ZHUDATUAN_BOOTSTRAP_ACCESS_POLICY_MISSING';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260829040000'
      and checksum='77166f2dd111907cdf0910060362a3144e86a0606c884a3d77c8134b0743173a') then
    raise exception 'ZHUDATUAN_REGISTRATION_BOOTSTRAP_REPAIR_MISSING';
  end if;
end
$assert$;

commit;
