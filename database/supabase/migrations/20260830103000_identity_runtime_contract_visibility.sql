begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:identity-runtime-contract-visibility:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'IDENTITY_RUNTIME_CONTRACT_VISIBILITY_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260830102000'
      and checksum='0c277dba0bf8af1e8bef9a6419cba87be8bb7e220f293193130e7d81e4cf2e1c') then
    raise exception 'IDENTITY_RUNTIME_CONTRACT_VISIBILITY_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion where version>'20260830102000') then
    raise exception 'IDENTITY_RUNTIME_CONTRACT_VISIBILITY_FUTURE_HEAD_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260829060000'
      and checksum='b1e238eb8de569b0de9d1d2766620e1f661268d2f9260e646208d4f24715b37a') then
    raise exception 'IDENTITY_RUNTIME_CONTRACT_VISIBILITY_INVITATION_MARKER_INVALID';
  end if;
end
$precondition$;

do $contract_update$
begin
  update runtime.schemaversion
  set checksum='d7e499c9530d8c7ab46cfb4bc30b4ad17cd39a9c16b9d444ac4a1927f25eae79'
  where version='20260821032000'
    and checksum='3d361b63c55c8500daf4a35aaa208f13a2739e485d772cd83d4129d09fe2c144';
  if not found then raise exception 'IDENTITY_RUNTIME_CONTRACT_CHECKSUM_PREDECESSOR_INVALID'; end if;
end
$contract_update$;

alter policy zhudatuanidentityapi on runtime.schemaversion
  using(version in('20260821032000','20260821054000','20260828170000','20260829060000'));

insert into runtime.schemaversion(version,checksum)
values('20260830103000','9d701527bc303309ed5536594aceddfb286fc59ec9bbf1d0b249075b5d7f99ae');

do $assert$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260821032000'
        and checksum='d7e499c9530d8c7ab46cfb4bc30b4ad17cd39a9c16b9d444ac4a1927f25eae79')
    or not exists(select 1 from pg_policies
      where schemaname='runtime' and tablename='schemaversion'
        and policyname='zhudatuanidentityapi' and roles=array['zhudatuanidentityapi']::name[]
        and qual like '%20260829060000%')
    or not exists(select 1 from runtime.schemaversion where version='20260830103000') then
    raise exception 'IDENTITY_RUNTIME_CONTRACT_VISIBILITY_ASSERTION_FAILED';
  end if;
end
$assert$;

commit;
