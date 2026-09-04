begin;

do $dependency$
begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260902134000'
      and checksum='8c7592eea524151e9639f1b26eb63bc04725279e9ba2e54129ee2cfe4a8fe836') then
    raise exception 'OWNER_IDENTITY_RUNTIME_BOUNDARY_DEPENDENCY_MISSING';
  end if;
end
$dependency$;

do $rewrite$
declare
  target oid;
  definition text;
  rewritten text;
begin
  for target in select unnest(array[
    'access.cancel_owner_transfer(text,text,text,text,bigint,bigint,bigint,text)'::regprocedure::oid,
    'access.change_zhudatuan_owner_mobile(text,text,text,text,text,text,text,text,text)'::regprocedure::oid,
    'access.commit_owner_transfer(text,text,text,text,bigint,bigint,bigint)'::regprocedure::oid,
    'access.create_owner_transfer(text,text,text,text,bigint,bigint)'::regprocedure::oid,
    'access.expire_owner_transfers()'::regprocedure::oid
  ]) loop
    select pg_get_functiondef(target) into definition;
    if regexp_count(definition,'''shopapp''')<>2 then
      raise exception 'OWNER_IDENTITY_RUNTIME_LEGACY_GUARD_INVALID:%',target::regprocedure;
    end if;
    rewritten:=replace(definition,'''shopapp''','''zhudatuanidentityapi''');
    if rewritten=definition or position('''shopapp''' in rewritten)>0
      or regexp_count(rewritten,'''zhudatuanidentityapi''')<>2 then
      raise exception 'OWNER_IDENTITY_RUNTIME_GUARD_REWRITE_FAILED:%',target::regprocedure;
    end if;
    execute rewritten;
  end loop;
end
$rewrite$;

revoke all on function access.cancel_owner_transfer(text,text,text,text,bigint,bigint,bigint,text)
  from public,shopapp,shopjob,shopread,shopconsole,zhudatuanidentityjob,zhudatuanwebapi,zhudatuanpurchaseapi,zhudatuanprovisioningapi;
revoke all on function access.change_zhudatuan_owner_mobile(text,text,text,text,text,text,text,text,text)
  from public,shopapp,shopjob,shopread,shopconsole,zhudatuanidentityjob,zhudatuanwebapi,zhudatuanpurchaseapi,zhudatuanprovisioningapi;
revoke all on function access.commit_owner_transfer(text,text,text,text,bigint,bigint,bigint)
  from public,shopapp,shopjob,shopread,shopconsole,zhudatuanidentityjob,zhudatuanwebapi,zhudatuanpurchaseapi,zhudatuanprovisioningapi;
revoke all on function access.create_owner_transfer(text,text,text,text,bigint,bigint)
  from public,shopapp,shopjob,shopread,shopconsole,zhudatuanidentityjob,zhudatuanwebapi,zhudatuanpurchaseapi,zhudatuanprovisioningapi;
revoke all on function access.expire_owner_transfers()
  from public,shopapp,shopjob,shopread,shopconsole,zhudatuanidentityjob,zhudatuanwebapi,zhudatuanpurchaseapi,zhudatuanprovisioningapi;

grant execute on function access.cancel_owner_transfer(text,text,text,text,bigint,bigint,bigint,text),
  access.change_zhudatuan_owner_mobile(text,text,text,text,text,text,text,text,text),
  access.commit_owner_transfer(text,text,text,text,bigint,bigint,bigint),
  access.create_owner_transfer(text,text,text,text,bigint,bigint),
  access.expire_owner_transfers()
  to zhudatuanidentityapi;

insert into runtime.schemaversion(version,checksum)
values('20260902135000','59c6e2aa76649325d864f72563c2d93fe1abd6457210c4bb2d0ffe3328cc8032');

do $assert$
declare
  target oid;
begin
  for target in select unnest(array[
    'access.cancel_owner_transfer(text,text,text,text,bigint,bigint,bigint,text)'::regprocedure::oid,
    'access.change_zhudatuan_owner_mobile(text,text,text,text,text,text,text,text,text)'::regprocedure::oid,
    'access.commit_owner_transfer(text,text,text,text,bigint,bigint,bigint)'::regprocedure::oid,
    'access.create_owner_transfer(text,text,text,text,bigint,bigint)'::regprocedure::oid,
    'access.expire_owner_transfers()'::regprocedure::oid
  ]) loop
    if position('''shopapp''' in pg_get_functiondef(target))>0
      or regexp_count(pg_get_functiondef(target),'''zhudatuanidentityapi''')<>2
      or not has_function_privilege('zhudatuanidentityapi',target,'EXECUTE') then
      raise exception 'OWNER_IDENTITY_RUNTIME_BOUNDARY_INVALID:%',target::regprocedure;
    end if;
    if exists(select 1 from (values
        ('shopapp'),('shopjob'),('shopread'),('shopconsole'),('zhudatuanidentityjob'),
        ('zhudatuanwebapi'),('zhudatuanpurchaseapi'),('zhudatuanprovisioningapi')
      ) denied(role_name) where has_function_privilege(denied.role_name,target,'EXECUTE')) then
      raise exception 'OWNER_IDENTITY_RUNTIME_BOUNDARY_LEAKED:%',target::regprocedure;
    end if;
  end loop;
  if not exists(select 1 from runtime.schemaversion
    where version='20260902135000'
      and checksum='59c6e2aa76649325d864f72563c2d93fe1abd6457210c4bb2d0ffe3328cc8032') then
    raise exception 'OWNER_IDENTITY_RUNTIME_BOUNDARY_LEDGER_MISSING';
  end if;
end
$assert$;

commit;
