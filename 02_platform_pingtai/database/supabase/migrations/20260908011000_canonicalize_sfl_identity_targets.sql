begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:canonicalize-sfl-identity-targets:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'SFL_IDENTITY_TARGET_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260908010000'
        and checksum='cdfe895c15e87feae76dece68dbc34928dd98ab8c75d50d88e80899cecff5f0b')
    or exists(select 1 from runtime.schemaversion where version>'20260908010000') then
    raise exception 'SFL_IDENTITY_TARGET_PREDECESSOR_INVALID';
  end if;
  if not exists(select 1 from identity.realmtarget where realm_id='realm:l1' and target='console-hbbtzn')
    or not exists(select 1 from identity.realmtarget where realm_id='realm:l1' and target='storefront-hbbtzn')
    or exists(select 1 from identity.realmtarget where realm_id='realm:l1' and target in('console','storefront')) then
    raise exception 'SFL_IDENTITY_TARGET_SOURCE_INVALID';
  end if;
end
$precondition$;

alter table identity.session drop constraint identity_session_realm_target;
alter table identity.authticket drop constraint identity_authticket_realm_target;
alter table identity.authticket drop constraint authticket_target_check;

update identity.session
set auth_target=case auth_target
  when 'console-hbbtzn' then 'console'
  when 'storefront-hbbtzn' then 'storefront'
end
where realm_id='realm:l1' and auth_target in('console-hbbtzn','storefront-hbbtzn');

update identity.authticket
set target=case target
  when 'console-hbbtzn' then 'console'
  when 'storefront-hbbtzn' then 'storefront'
end
where realm_id='realm:l1' and target in('console-hbbtzn','storefront-hbbtzn');

update identity.realmtarget
set target=case target
  when 'console-hbbtzn' then 'console'
  when 'storefront-hbbtzn' then 'storefront'
end
where realm_id='realm:l1' and target in('console-hbbtzn','storefront-hbbtzn');

alter table identity.authticket add constraint authticket_target_check
  check(target in('console','storefront','store','supplier'));
alter table identity.session add constraint identity_session_realm_target
  foreign key(realm_id,auth_target) references identity.realmtarget(realm_id,target);
alter table identity.authticket add constraint identity_authticket_realm_target
  foreign key(realm_id,target) references identity.realmtarget(realm_id,target);

insert into runtime.schemaversion(version,checksum)
values('20260908011000','e60f65ce0d94f0247e0945f174f624c29f4cf4c7aa07deadd3e8a7ad811c7dff');

do $assert$
begin
  if not exists(select 1 from identity.realmtarget
      where realm_id='realm:l0' and target='console' and return_origin='https://console.zhudatuan.com')
    or not exists(select 1 from identity.realmtarget
      where realm_id='realm:l1' and target='console' and return_origin='https://console.hbbtzn.com')
    or not exists(select 1 from identity.realmtarget
      where realm_id='realm:l0' and target='storefront' and return_origin='https://zhudatuan.com')
    or not exists(select 1 from identity.realmtarget
      where realm_id='realm:l1' and target='storefront' and return_origin='https://hbbtzn.com')
    or exists(select 1 from identity.realmtarget where target in('console-hbbtzn','storefront-hbbtzn'))
    or exists(select 1 from identity.session where auth_target in('console-hbbtzn','storefront-hbbtzn'))
    or exists(select 1 from identity.authticket where target in('console-hbbtzn','storefront-hbbtzn'))
    or not exists(select 1 from runtime.schemaversion
      where version='20260908011000'
        and checksum='e60f65ce0d94f0247e0945f174f624c29f4cf4c7aa07deadd3e8a7ad811c7dff') then
    raise exception 'SFL_IDENTITY_TARGET_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
