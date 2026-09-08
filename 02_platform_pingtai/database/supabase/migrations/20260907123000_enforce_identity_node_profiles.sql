begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:enforce-identity-node-profiles:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'IDENTITY_NODE_PROFILE_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260907122000'
        and checksum='1efe07e3ac4ae654889a7a6a7ba61611e20a6c7d24a1c3afe07d1a7ab60ec734')
    or exists(select 1 from runtime.schemaversion where version>'20260907122000') then
    raise exception 'IDENTITY_NODE_PROFILE_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

alter table identity.realm
  add column node_profile text not null default 'operating_mall',
  add column mall_id text,
  add column host_node_id text,
  add column host_node_profile text;

update identity.realm
set node_profile='operating_mall',
  mall_id=case id
    when 'realm:l0' then 'mall-zhudatuan'
    when 'realm:l1' then 'mall:d1708f04df2dd8a61736852c4900fb43'
  end
where id in('realm:l0','realm:l1');

alter table identity.realm alter column node_profile drop default;
alter table identity.realm add constraint identity_realm_node_profile_shape check(
  (node_profile='operating_mall' and mall_id is not null and host_node_id is null and host_node_profile is null)
  or (node_profile='consumer' and mall_id is null and host_node_id is not null
    and host_node_profile='operating_mall' and host_node_id<>node_id)
);
alter table identity.realm add constraint identity_realm_id_node_profile_unique unique(id,node_profile);
alter table identity.realm add constraint identity_realm_node_id_profile_unique unique(node_id,node_profile);
alter table identity.realm add constraint identity_realm_consumer_host
  foreign key(host_node_id,host_node_profile) references identity.realm(node_id,node_profile);

alter table identity.realmtarget add column node_profile text not null default 'operating_mall';
alter table identity.realmtarget add constraint identity_realmtarget_realm_profile
  foreign key(realm_id,node_profile) references identity.realm(id,node_profile);
alter table identity.realmtarget add constraint identity_realmtarget_profile_surface check(
  node_profile='operating_mall'
  or (node_profile='consumer' and surface='consumer' and membership_client='storefront')
);
alter table identity.realmtarget alter column node_profile drop default;

alter table access.membership add column node_profile text not null default 'operating_mall';
alter table access.membership add constraint access_membership_realm_profile
  foreign key(realm_id,node_profile) references identity.realm(id,node_profile);
alter table access.membership add constraint access_membership_profile_client check(
  node_profile='operating_mall' or client='storefront'
);

insert into runtime.schemaversion(version,checksum)
values('20260907123000','0293ec3014459ff693e28042787c6e3b5866da28608623c079fb8ab0088f6402');

do $assert$
begin
  if exists(select 1 from identity.realm
      where (node_profile='operating_mall') is distinct from (mall_id is not null))
    or exists(select 1 from identity.realm
      where node_profile='consumer' and (host_node_id is null or host_node_profile<>'operating_mall')) then
    raise exception 'IDENTITY_NODE_PROFILE_REALM_INVALID';
  end if;
  if exists(select 1 from identity.realmtarget target join identity.realm realm on realm.id=target.realm_id
      where target.node_profile<>realm.node_profile
        or (realm.node_profile='consumer' and (target.surface<>'consumer' or target.membership_client<>'storefront'))) then
    raise exception 'IDENTITY_NODE_PROFILE_TARGET_INVALID';
  end if;
  if exists(select 1 from access.membership membership join identity.realm realm on realm.id=membership.realm_id
      where membership.node_profile<>realm.node_profile
        or (realm.node_profile='consumer' and membership.client<>'storefront')) then
    raise exception 'IDENTITY_NODE_PROFILE_MEMBERSHIP_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260907123000'
        and checksum='0293ec3014459ff693e28042787c6e3b5866da28608623c079fb8ab0088f6402') then
    raise exception 'IDENTITY_NODE_PROFILE_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
