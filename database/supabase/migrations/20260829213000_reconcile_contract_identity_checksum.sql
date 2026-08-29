begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:contract-identity-checksum:v1'));

do $boundary_guard$
declare current_checksum text;
begin
  if not (
    (current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)
  ) then
    raise exception 'CONTRACT_IDENTITY_CHECKSUM_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260829212000'
      and checksum='7623f50639c67d35887b1e9c1f261f9c21057cb3694f7e5d40ef3b17f56cb774') then
    raise exception 'CONTRACT_IDENTITY_CHECKSUM_PREDECESSOR_INVALID';
  end if;
  if exists(select 1 from runtime.schemaversion
    where version>'20260829212000' and version<>'20260829213000') then
    raise exception 'CONTRACT_IDENTITY_CHECKSUM_FUTURE_HEAD_INVALID';
  end if;

  select checksum into current_checksum
  from runtime.schemaversion
  where version='20260821032000';
  if current_checksum is null or current_checksum not in(
    '83892ce3a42c15ab21703902380b63b6cc3352000d0c4c2a9df50b60347e383a',
    '7be24c44ea3397d9d1429dda127479bf84efbc5d9b94cc41322db148e4b83f66'
  ) then
    raise exception 'CONTRACT_IDENTITY_CHECKSUM_UNKNOWN:%',coalesce(current_checksum,'missing');
  end if;
end
$boundary_guard$;

update runtime.schemaversion
set checksum='7be24c44ea3397d9d1429dda127479bf84efbc5d9b94cc41322db148e4b83f66'
where version='20260821032000'
  and checksum='83892ce3a42c15ab21703902380b63b6cc3352000d0c4c2a9df50b60347e383a';

insert into runtime.schemaversion(version,checksum)
values('20260829213000','7250097cd72cfd86ac5dc381c84656245578b169b18fb7eec5044840b79dfce4')
on conflict(version) do nothing;

do $assert$
begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260821032000'
      and checksum='7be24c44ea3397d9d1429dda127479bf84efbc5d9b94cc41322db148e4b83f66') then
    raise exception 'CONTRACT_IDENTITY_CHECKSUM_RECONCILIATION_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260829213000'
      and checksum='7250097cd72cfd86ac5dc381c84656245578b169b18fb7eec5044840b79dfce4') then
    raise exception 'CONTRACT_IDENTITY_CHECKSUM_SCHEMA_VERSION_INVALID';
  end if;
end
$assert$;

commit;
