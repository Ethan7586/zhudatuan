begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:canonicalize-sfl-identity-node-ids:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'SFL_IDENTITY_NODE_ID_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260907123000'
        and checksum='0293ec3014459ff693e28042787c6e3b5866da28608623c079fb8ab0088f6402')
    or exists(select 1 from runtime.schemaversion where version>'20260907123000') then
    raise exception 'SFL_IDENTITY_NODE_ID_PREDECESSOR_INVALID';
  end if;
  if not exists(select 1 from identity.realm where id='realm:l0' and node_id='l0')
    or not exists(select 1 from identity.realm where id='realm:l1' and node_id='l1')
    or exists(select 1 from identity.realm where id not in('realm:l0','realm:l1')) then
    raise exception 'SFL_IDENTITY_NODE_ID_SOURCE_REGISTRY_INVALID';
  end if;
end
$precondition$;

alter table identity.realm drop constraint identity_realm_consumer_host;
alter table identity.realm drop constraint realm_node_id_check;

update identity.realm
set host_node_id=case host_node_id
  when 'l0' then 'node:zhudatuan:l0'
  when 'l1' then 'node:hbbtzn:l1'
  else host_node_id
end
where host_node_id in('l0','l1');

update identity.realm
set node_id=case id
  when 'realm:l0' then 'node:zhudatuan:l0'
  when 'realm:l1' then 'node:hbbtzn:l1'
end,
updated_at=clock_timestamp()
where id in('realm:l0','realm:l1');

alter table identity.realm add constraint identity_realm_node_id_shape
  check(node_id ~ '^node:[a-z0-9][a-z0-9-]{0,62}:l[0-9]{1,3}$');
alter table identity.realm add constraint identity_realm_consumer_host
  foreign key(host_node_id,host_node_profile) references identity.realm(node_id,node_profile);

insert into runtime.schemaversion(version,checksum)
values('20260908010000','cdfe895c15e87feae76dece68dbc34928dd98ab8c75d50d88e80899cecff5f0b');

do $assert$
begin
  if not exists(select 1 from identity.realm
      where id='realm:l0' and node_id='node:zhudatuan:l0' and node_profile='operating_mall')
    or not exists(select 1 from identity.realm
      where id='realm:l1' and node_id='node:hbbtzn:l1' and node_profile='operating_mall')
    or exists(select 1 from identity.realm where node_id in('l0','l1'))
    or exists(select 1 from identity.realm where host_node_id in('l0','l1'))
    or not exists(select 1 from runtime.schemaversion
      where version='20260908010000'
        and checksum='cdfe895c15e87feae76dece68dbc34928dd98ab8c75d50d88e80899cecff5f0b') then
    raise exception 'SFL_IDENTITY_NODE_ID_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
