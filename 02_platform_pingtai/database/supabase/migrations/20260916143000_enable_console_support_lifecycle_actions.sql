begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:console-support-lifecycle-actions:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260916123000'
      and checksum='566f98cc283cabf3d9327186f1f591f68b16ffb8f9326747db87f26bc2f39a24') then
    raise exception 'CONSOLE_SUPPORT_LIFECYCLE_PREDECESSOR_MISSING';
  end if;
  if to_regrole('shopconsole') is null
    or to_regclass('support.assignment') is null
    or to_regclass('support.escalation') is null
    or not exists(select 1 from access.role where id='role-platform-owner-v2' and status='active')
    or not exists(select 1 from access.role where id='role-l1-owner-v1:tenant-zhudatuan' and status='active') then
    raise exception 'CONSOLE_SUPPORT_LIFECYCLE_DEPENDENCY_MISSING';
  end if;
end
$precondition$;

grant select,update on support.assignment to shopconsole;
grant select,insert on support.escalation to shopconsole;

create policy consolesupportassignmentselect on support.assignment for select to shopconsole
using(access.scope_allowed(scope_id));
create policy consolesupportassignmentupdate on support.assignment for update to shopconsole
using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id));
create policy consolesupportescalationselect on support.escalation for select to shopconsole
using(access.scope_allowed(scope_id));
create policy consolesupportescalationinsert on support.escalation for insert to shopconsole
with check(access.scope_allowed(scope_id));

delete from access.rolepermission mapping
using access.permission permission
where mapping.role_id in('role-platform-owner-v2','role-l1-owner-v1:tenant-zhudatuan')
  and mapping.permission_id=permission.id
  and permission.code in('support.case.manage','support.assignment.manage','support.agent.read','support.history.read')
  and mapping.effect='deny';

insert into access.rolepermission(role_id,permission_id,effect)
select owner_role.id,permission.id,'allow'
from (values('role-platform-owner-v2'),('role-l1-owner-v1:tenant-zhudatuan')) owner_role(id)
cross join access.permission permission
where permission.code in('support.case.manage','support.assignment.manage','support.agent.read','support.history.read')
  and permission.status='active'
on conflict do nothing;

insert into runtime.schemaversion(version,checksum)
values('20260916143000','bd223ecb2e04ba29dce4c4a5b5785741c01cb2e1d746466c91d4da82c46115f6');

do $assert$
begin
  if not has_table_privilege('shopconsole','support.assignment','SELECT,INSERT,UPDATE')
    or has_table_privilege('shopconsole','support.assignment','DELETE')
    or not has_table_privilege('shopconsole','support.escalation','SELECT,INSERT')
    or has_table_privilege('shopconsole','support.escalation','UPDATE,DELETE')
    or not exists(select 1 from pg_policies where schemaname='support' and tablename='assignment'
      and policyname in('consolesupportassignmentselect','consolesupportassignmentupdate') group by schemaname having count(*)=2)
    or not exists(select 1 from pg_policies where schemaname='support' and tablename='escalation'
      and policyname in('consolesupportescalationselect','consolesupportescalationinsert') group by schemaname having count(*)=2)
    or exists(
      select 1 from (values('role-platform-owner-v2'),('role-l1-owner-v1:tenant-zhudatuan')) owner_role(id)
      cross join (values('support.case.manage'),('support.assignment.manage'),('support.agent.read'),
        ('support.history.read')) required(code)
      where not exists(
        select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
        where mapping.role_id=owner_role.id and permission.code=required.code and mapping.effect='allow'
      )
    )
    or not exists(select 1 from runtime.schemaversion
      where version='20260916143000'
        and checksum='bd223ecb2e04ba29dce4c4a5b5785741c01cb2e1d746466c91d4da82c46115f6') then
    raise exception 'CONSOLE_SUPPORT_LIFECYCLE_SCHEMA_INVALID';
  end if;
end
$assert$;

commit;
