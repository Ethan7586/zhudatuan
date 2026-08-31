begin;

do $contract$
declare
  operation_hash text;
  capability_hash text;
  event_hash text;
begin
  select encode(digest(string_agg(
    id||chr(31)||owner||chr(31)||method||chr(31)||path||chr(31)||contract_version,
    chr(30) order by id
  ),'sha256'),'hex')
  into operation_hash
  from runtime.operation;

  select encode(digest(string_agg(
    operation_id||chr(31)||capability_id||chr(31)||coalesce(permission_code,'')||chr(31)||audience,
    chr(30) order by operation_id
  ),'sha256'),'hex')
  into capability_hash
  from capability.operation;

  select encode(digest(string_agg(
    type||chr(31)||version::text||chr(31)||owner||chr(31)||schema_ref,
    chr(30) order by type,version
  ),'sha256'),'hex')
  into event_hash
  from runtime.event;

  if operation_hash<>'70723ed0db528df0dd70c83370bf252443aa962454e6808483945d3c2647dbd6'
    or capability_hash<>'57d2c5129258077f0b3891a4c949ced375a4b4fba669f6c5723bdc87fa2f25c3'
    or event_hash<>'205710e90cbb953ac3490bf5d28016ab0860d0b5aea31836a67d3985b5e7cf5a'
  then
    raise exception 'RUNTIME_CONTRACT_CATALOG_FINGERPRINT_MISMATCH';
  end if;

  update runtime.schemaversion
  set checksum='9accf457c29e31374c87d8cb35286b789b3e512451862a67f10c57008475891a'
  where version='20260821032000';
  if not found then raise exception 'RUNTIME_CONTRACT_SCHEMA_VERSION_MISSING'; end if;
end
$contract$;

insert into runtime.schemaversion(version,checksum)
values('20260829201000','1b7fde9ae524a69da25c143bd675ab37ee753a63b8cea712e3d12ed57fa731d3');

do $assert$
begin
  if not exists(
    select 1 from runtime.schemaversion
    where version='20260821032000'
      and checksum='9accf457c29e31374c87d8cb35286b789b3e512451862a67f10c57008475891a'
  ) or not exists(
    select 1 from runtime.schemaversion where version='20260829201000'
  ) then
    raise exception 'RUNTIME_CONTRACT_CHECKSUM_RECONCILIATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
