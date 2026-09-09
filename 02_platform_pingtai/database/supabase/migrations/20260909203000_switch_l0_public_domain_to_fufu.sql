begin;

select pg_advisory_xact_lock(hashtext('identity:switch-l0-public-domain-to-fufu:v1'));

create temporary table before_non_l0_realmentry on commit drop as
select host,realm_id,kind,status,created_at from identity.realmentry where realm_id<>'realm:l0';
create temporary table before_non_l0_realmtarget on commit drop as
select realm_id,surface,target,membership_client,membership_organization_id,application_slug,
  return_origin,created_at,node_profile from identity.realmtarget where realm_id<>'realm:l0';

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'L0_PUBLIC_DOMAIN_CONTEXT_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
      where version='20260909160000'
        and checksum='dcb84951a9c0087ec12c6bf09e67285b3cb66995b3144df2d6ed3f4315553f82')
    or exists(select 1 from runtime.schemaversion where version>'20260909160000') then
    raise exception 'L0_PUBLIC_DOMAIN_PREDECESSOR_INVALID';
  end if;
  if (select count(*) from identity.realmentry where realm_id='realm:l0')<>2
    or not exists(select 1 from identity.realmentry where realm_id='realm:l0'
      and host='accounts.zhudatuan.com' and kind='accounts' and status='active')
    or not exists(select 1 from identity.realmentry where realm_id='realm:l0'
      and host='api.zhudatuan.com' and kind='api' and status='active')
    or exists(select 1 from identity.realmentry where host in('accounts.fufu.wang','api.fufu.wang','fufu.wang')) then
    raise exception 'L0_PUBLIC_DOMAIN_ENTRY_SOURCE_INVALID';
  end if;
  if (select count(*) from identity.realmtarget where realm_id='realm:l0')<>4
    or not exists(select 1 from identity.realmtarget where realm_id='realm:l0' and target='console'
      and return_origin='https://console.zhudatuan.com')
    or not exists(select 1 from identity.realmtarget where realm_id='realm:l0' and target='store'
      and return_origin='https://console.zhudatuan.com/entrances/store')
    or not exists(select 1 from identity.realmtarget where realm_id='realm:l0' and target='supplier'
      and return_origin='https://console.zhudatuan.com/entrances/supplier')
    or not exists(select 1 from identity.realmtarget where realm_id='realm:l0' and target='storefront'
      and return_origin='https://zhudatuan.com') then
    raise exception 'L0_PUBLIC_DOMAIN_TARGET_SOURCE_INVALID';
  end if;
end
$precondition$;

update identity.realmentry set host=case kind
  when 'accounts' then 'accounts.fufu.wang'
  when 'api' then 'api.fufu.wang'
end
where realm_id='realm:l0' and kind in('accounts','api');

insert into identity.realmentry(host,realm_id,kind,status,created_at)
values('fufu.wang','realm:l0','storefront','active',clock_timestamp());

update identity.realmtarget set return_origin=case target
  when 'console' then 'https://console.fufu.wang'
  when 'store' then 'https://console.fufu.wang/entrances/store'
  when 'supplier' then 'https://console.fufu.wang/entrances/supplier'
  when 'storefront' then 'https://fufu.wang'
end
where realm_id='realm:l0' and target in('console','store','supplier','storefront');

insert into runtime.schemaversion(version,checksum)
values('20260909203000','31ed21bd9351a3678742c2b0c10a1a2b725cbbfef09d5888b609569a2f3610ba');

do $assert$
begin
  if (select count(*) from identity.realmentry where realm_id='realm:l0')<>3
    or not exists(select 1 from identity.realmentry where realm_id='realm:l0'
      and host='accounts.fufu.wang' and kind='accounts' and status='active')
    or not exists(select 1 from identity.realmentry where realm_id='realm:l0'
      and host='api.fufu.wang' and kind='api' and status='active')
    or not exists(select 1 from identity.realmentry where realm_id='realm:l0'
      and host='fufu.wang' and kind='storefront' and status='active')
    or exists(select 1 from identity.realmentry where realm_id='realm:l0' and host like '%.zhudatuan.com')
    or (select count(*) from identity.realmtarget where realm_id='realm:l0')<>4
    or not exists(select 1 from identity.realmtarget where realm_id='realm:l0' and target='console'
      and return_origin='https://console.fufu.wang')
    or not exists(select 1 from identity.realmtarget where realm_id='realm:l0' and target='store'
      and return_origin='https://console.fufu.wang/entrances/store')
    or not exists(select 1 from identity.realmtarget where realm_id='realm:l0' and target='supplier'
      and return_origin='https://console.fufu.wang/entrances/supplier')
    or not exists(select 1 from identity.realmtarget where realm_id='realm:l0' and target='storefront'
      and return_origin='https://fufu.wang')
    or exists(select 1 from identity.realmtarget where realm_id='realm:l0' and return_origin like '%zhudatuan.com%')
    or exists((select * from before_non_l0_realmentry except
      select host,realm_id,kind,status,created_at from identity.realmentry where realm_id<>'realm:l0')
      union all
      (select host,realm_id,kind,status,created_at from identity.realmentry where realm_id<>'realm:l0'
        except select * from before_non_l0_realmentry))
    or exists((select * from before_non_l0_realmtarget except
      select realm_id,surface,target,membership_client,membership_organization_id,application_slug,
        return_origin,created_at,node_profile from identity.realmtarget where realm_id<>'realm:l0')
      union all
      (select realm_id,surface,target,membership_client,membership_organization_id,application_slug,
        return_origin,created_at,node_profile from identity.realmtarget where realm_id<>'realm:l0'
        except select * from before_non_l0_realmtarget))
    or not exists(select 1 from runtime.schemaversion
      where version='20260909203000'
        and checksum='31ed21bd9351a3678742c2b0c10a1a2b725cbbfef09d5888b609569a2f3610ba') then
    raise exception 'L0_PUBLIC_DOMAIN_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
