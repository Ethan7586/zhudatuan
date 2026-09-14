begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:console-support-case-create:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260902133000'
      and checksum='0773015646b923fcf9e66a68c444fc164f6fadfb49d48f19344d59d638d66c4a') then
    raise exception 'CONSOLE_SUPPORT_CASE_CREATE_PREDECESSOR_MISSING';
  end if;
  if to_regrole('shopconsole') is null
    or to_regclass('support.ticket') is null
    or to_regclass('support.conversation') is null
    or to_regclass('support.message') is null
    or to_regclass('support.history') is null
    or to_regclass('support.assignment') is null
    or to_regclass('support.agent') is null
    or to_regclass('support.assignmentrule') is null
    or to_regclass('support.sla') is null
    or to_regclass('runtime.job') is null then
    raise exception 'CONSOLE_SUPPORT_CASE_CREATE_DEPENDENCY_MISSING';
  end if;
end
$precondition$;

alter table support.ticket alter column response_due_at drop not null;
alter table support.ticket alter column resolution_due_at drop not null;

grant select on support.agent,support.assignmentrule,support.sla,support.history to shopconsole;
grant insert on support.conversation,support.ticket,support.assignment to shopconsole;
grant insert on runtime.job to shopconsole;

create policy consolesupportagentselect on support.agent for select to shopconsole
using(access.scope_allowed(scope_id));
create policy consolesupportassignmentruleselect on support.assignmentrule for select to shopconsole
using(access.scope_allowed(scope_id));
create policy consolesupportslaselect on support.sla for select to shopconsole
using(exists(
  select 1 from organization.unitclosure closure
  where closure.ancestor_id=support.sla.scope_id
    and closure.descendant_id=nullif(current_setting('app.scope_id',true),'')
));
create policy consolesupporthistoryselect on support.history for select to shopconsole
using(access.scope_allowed(scope_id));
create policy consolesupportconversationinsert on support.conversation for insert to shopconsole
with check(access.scope_allowed(scope_id));
create policy consolesupportticketinsert on support.ticket for insert to shopconsole
with check(access.scope_allowed(scope_id));
create policy consolesupportassignmentinsert on support.assignment for insert to shopconsole
with check(access.scope_allowed(scope_id));
create policy consolesupportjobinsert on runtime.job for insert to shopconsole
with check(owner='support' and kind in('supportsla','supportscan') and access.scope_allowed(scope_id));

insert into runtime.schemaversion(version,checksum)
values('20260914150000','56fc6fb789e904fe929720c30ba98756abf470c12372dbc5b6a1255e8444710e');

do $assert$
begin
  if not has_table_privilege('shopconsole','support.ticket','SELECT,INSERT,UPDATE')
    or not has_table_privilege('shopconsole','support.conversation','SELECT,INSERT,UPDATE')
    or not has_table_privilege('shopconsole','support.message','SELECT,INSERT')
    or not has_table_privilege('shopconsole','support.history','SELECT,INSERT')
    or not has_table_privilege('shopconsole','support.agent','SELECT')
    or not has_table_privilege('shopconsole','support.assignmentrule','SELECT')
    or not has_table_privilege('shopconsole','support.sla','SELECT')
    or not has_table_privilege('shopconsole','support.assignment','INSERT')
    or not has_table_privilege('shopconsole','runtime.job','INSERT') then
    raise exception 'CONSOLE_SUPPORT_CASE_CREATE_ACL_MISSING';
  end if;
  if has_table_privilege('shopconsole','support.agent','INSERT,UPDATE,DELETE')
    or has_table_privilege('shopconsole','support.assignmentrule','INSERT,UPDATE,DELETE')
    or has_table_privilege('shopconsole','support.sla','INSERT,UPDATE,DELETE')
    or has_table_privilege('shopconsole','support.ticket','DELETE')
    or has_table_privilege('shopconsole','support.conversation','DELETE')
    or has_table_privilege('shopconsole','runtime.job','SELECT,UPDATE,DELETE') then
    raise exception 'CONSOLE_SUPPORT_CASE_CREATE_ACL_TOO_BROAD';
  end if;
  if exists(select 1 from pg_attribute
      where attrelid='support.ticket'::regclass and attname in('response_due_at','resolution_due_at') and attnotnull)
    or not exists(select 1 from runtime.schemaversion
      where version='20260914150000'
        and checksum='56fc6fb789e904fe929720c30ba98756abf470c12372dbc5b6a1255e8444710e') then
    raise exception 'CONSOLE_SUPPORT_CASE_CREATE_SCHEMA_INVALID';
  end if;
end
$assert$;

commit;
