begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:brand-display-names:v1'));

do $precondition$
begin
  if not ((current_database()='zhudatuan_registration' and current_user='shopmigration')
    or coalesce((select rolsuper from pg_roles where rolname=current_user),false)) then
    raise exception 'ZHUDATUAN_BRAND_DISPLAY_NAMES_DATABASE_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260831150000'
      and checksum='0ff4aba32aa64206955513760655589f9d0537598f1e47b174b49ae98fd7b074')
    or exists(select 1 from runtime.schemaversion where version>'20260831150000') then
    raise exception 'ZHUDATUAN_BRAND_DISPLAY_NAMES_PREDECESSOR_INVALID';
  end if;
  if not exists(select 1 from organization.organization
      where id='tenant-smart-wing' and name in('智慧翼福利平台','主打团历史演示平台'))
    or not exists(select 1 from organization.organization
      where id='mall-demo' and name in('智慧翼企业福利商城','主打团历史演示商城'))
    or not exists(select 1 from experience.application
      where id='application:mall-demo' and name in('智慧翼企业福利商城','主打团历史演示商城'))
    or not exists(select 1 from catalog.pool
      where id='pool-bootstrap-mall-demo' and name in('智慧翼企业福利商城 · 已选商品池','主打团历史演示商城 · 已选商品池')) then
    raise exception 'ZHUDATUAN_BRAND_DISPLAY_NAMES_SOURCE_INVALID';
  end if;
end
$precondition$;

update organization.organization
set name='主打团历史演示平台',version=version+1,updated_at=clock_timestamp()
where id='tenant-smart-wing' and name='智慧翼福利平台';

update organization.organization
set name='主打团历史演示商城',version=version+1,updated_at=clock_timestamp()
where id='mall-demo' and name='智慧翼企业福利商城';

update experience.application
set name='主打团历史演示商城',version=version+1,updated_at=clock_timestamp()
where id='application:mall-demo' and name='智慧翼企业福利商城';

update catalog.pool
set name='主打团历史演示商城 · 已选商品池',version=version+1
where id='pool-bootstrap-mall-demo' and name='智慧翼企业福利商城 · 已选商品池';

insert into runtime.schemaversion(version,checksum)
values('20260901060000','7df7a9d670de5071431a8f3539582f05fd949336f530ce7781adff5d76dc2097');

do $assert$
begin
  if not exists(select 1 from organization.organization
      where id='tenant-smart-wing' and name='主打团历史演示平台')
    or not exists(select 1 from organization.organization
      where id='mall-demo' and name='主打团历史演示商城')
    or not exists(select 1 from experience.application
      where id='application:mall-demo' and name='主打团历史演示商城')
    or not exists(select 1 from catalog.pool
      where id='pool-bootstrap-mall-demo' and name='主打团历史演示商城 · 已选商品池') then
    raise exception 'ZHUDATUAN_BRAND_DISPLAY_NAMES_NOT_APPLIED';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260901060000' and checksum='7df7a9d670de5071431a8f3539582f05fd949336f530ce7781adff5d76dc2097') then
    raise exception 'ZHUDATUAN_BRAND_DISPLAY_NAMES_LEDGER_MISSING';
  end if;
end
$assert$;

commit;
