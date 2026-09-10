begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:runtime-readiness-repair:v1'));

do $boundary_guard$
begin
  if not (
    current_user='shopmigration'
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)
  ) then
    raise exception 'ZHUDATUAN_RUNTIME_READINESS_REPAIR_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260828180000'
      and checksum='0d3eb3e766c32ea0dada6a982bb07a1e797f0b3a08d8104235f2894f3721d81c') then
    raise exception 'ZHUDATUAN_RUNTIME_READINESS_REPAIR_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion
    where version>'20260828180000' and version<>'20260828183000') then
    raise exception 'ZHUDATUAN_RUNTIME_READINESS_REPAIR_FUTURE_HEAD_INVALID';
  end if;
end
$boundary_guard$;

-- Reconcile the database marker with the current generated API/event/
-- permission/error contract. Refuse to hide an unknown third checksum: this
-- repair may advance the known console publication or replay idempotently.
do $contract_guard$
declare current_checksum text;
begin
  select checksum into current_checksum
  from runtime.schemaversion
  where version='20260821032000';
  if current_checksum is null or current_checksum not in(
    'b4b1aae5aa73442ff58231904a3d6bd0627bfc8614f2d7e0698a7fb3f8d46093',
    '83892ce3a42c15ab21703902380b63b6cc3352000d0c4c2a9df50b60347e383a'
  ) then
    raise exception 'RUNTIME_CONTRACT_CHECKSUM_UNKNOWN:%',coalesce(current_checksum,'missing');
  end if;
end
$contract_guard$;

update runtime.schemaversion
set checksum='83892ce3a42c15ab21703902380b63b6cc3352000d0c4c2a9df50b60347e383a'
where version='20260821032000'
  and checksum='b4b1aae5aa73442ff58231904a3d6bd0627bfc8614f2d7e0698a7fb3f8d46093';

-- The registration-only roles receive SELECT on runtime.schemaversion in the
-- baseline, but RLS previously had no matching policies for them. Keep each
-- role limited to the exact markers required by its startup/bootstrap checks.
drop policy if exists zhudatuanidentityapi on runtime.schemaversion;
create policy zhudatuanidentityapi on runtime.schemaversion for select to zhudatuanidentityapi
  using(version in('20260821032000','20260821054000','20260828170000'));

drop policy if exists zhudatuanidentityjob on runtime.schemaversion;
create policy zhudatuanidentityjob on runtime.schemaversion for select to zhudatuanidentityjob
  using(version in('20260821032000','20260821054000','20260828170000'));

drop policy if exists zhudatuanbootstrap on runtime.schemaversion;
create policy zhudatuanbootstrap on runtime.schemaversion for select to zhudatuanbootstrap
  using(version='20260828170000');

insert into runtime.schemaversion(version,checksum)
values('20260828183000','dea267e01bc8905433242ae5cb026948750587749c5178a59ba5d08a18e0d0b8')
on conflict(version) do nothing;

do $assert$
begin
  if (select count(*) from pg_roles where rolname in('anon','authenticated','service_role'))<>3
    or exists(select 1 from pg_roles where rolname in('anon','authenticated','service_role')
      and (rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or rolreplication
        or (rolbypassrls and rolname<>'service_role')))
    or exists(select 1 from pg_auth_members membership
      where (membership.roleid in(select oid from pg_roles where rolname in('anon','authenticated','service_role'))
          and membership.member in(select oid from pg_roles where rolname in(
            'shopapp','shopjob','shopmigration','shopprovider','shopread','zhudatuanidentityapi','zhudatuanidentityjob',
            'zhudatuanbootstrap','zhudatuanwebapi','zhudatuanpurchaseapi','zhudatuansandboxbootstrap'
          )))
        or (membership.member in(select oid from pg_roles where rolname in('anon','authenticated','service_role'))
          and membership.roleid in(select oid from pg_roles where rolname in(
            'shopapp','shopjob','shopmigration','shopprovider','shopread','zhudatuanidentityapi','zhudatuanidentityjob',
            'zhudatuanbootstrap','zhudatuanwebapi','zhudatuanpurchaseapi','zhudatuansandboxbootstrap'
          )))) then
    raise exception 'SUPABASE_ACL_COMPATIBILITY_ROLE_INVALID';
  end if;
  if not exists(select 1 from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='runtime' and relation.relname='schemaversion' and relation.relrowsecurity) then
    raise exception 'RUNTIME_SCHEMA_VERSION_RLS_DISABLED';
  end if;
  if exists(select 1 from (values
      ('zhudatuanidentityapi'),('zhudatuanidentityjob'),('zhudatuanbootstrap')
    ) required(role_name)
    where not has_table_privilege(required.role_name,'runtime.schemaversion','SELECT')
      or has_table_privilege(required.role_name,'runtime.schemaversion','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) then
    raise exception 'RUNTIME_SCHEMA_VERSION_ROLE_PRIVILEGE_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion where version='20260821032000'
    and checksum='83892ce3a42c15ab21703902380b63b6cc3352000d0c4c2a9df50b60347e383a') then
    raise exception 'RUNTIME_CONTRACT_CHECKSUM_MISMATCH';
  end if;
  if (select count(*) from pg_policies where schemaname='runtime' and tablename='schemaversion'
    and policyname in('zhudatuanidentityapi','zhudatuanidentityjob','zhudatuanbootstrap'))<>3 then
    raise exception 'REGISTRATION_SCHEMA_VERSION_POLICY_MISSING';
  end if;
  if not exists(select 1 from runtime.schemaversion where version='20260828183000'
    and checksum='dea267e01bc8905433242ae5cb026948750587749c5178a59ba5d08a18e0d0b8') then
    raise exception 'ZHUDATUAN_RUNTIME_READINESS_REPAIR_MISSING';
  end if;
end
$assert$;

commit;
