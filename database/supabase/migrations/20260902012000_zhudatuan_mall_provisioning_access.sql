begin;

do $role$
begin
  if to_regrole('zhudatuanprovisioningapi') is null then
    if not coalesce((select rolsuper or rolcreaterole from pg_roles where rolname=current_user),false) then
      raise exception 'ZHUDATUAN_PROVISIONING_DATABASE_ROLE_PREPROVISION_REQUIRED';
    end if;
    create role zhudatuanprovisioningapi nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
  if exists(select 1 from pg_roles where rolname='zhudatuanprovisioningapi'
    and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls))
    or exists(select 1 from pg_auth_members membership
      where membership.roleid=to_regrole('zhudatuanprovisioningapi')
        or membership.member=to_regrole('zhudatuanprovisioningapi')) then
    raise exception 'ZHUDATUAN_PROVISIONING_DATABASE_ROLE_UNSAFE';
  end if;
end
$role$;

grant usage on schema runtime,identity,access,capability,risk,audit,organization,catalog,experience
  to zhudatuanprovisioningapi;
grant select on runtime.schemaversion to zhudatuanprovisioningapi;
grant select,insert,update on runtime.idempotency to zhudatuanprovisioningapi;
grant insert on runtime.outbox to zhudatuanprovisioningapi;
grant select,insert on access.decisionaudit to zhudatuanprovisioningapi;
grant select on risk.policy,risk.policyversion,risk.signal,risk.listentry to zhudatuanprovisioningapi;
grant select,insert on risk.decision to zhudatuanprovisioningapi;
grant insert on risk.case to zhudatuanprovisioningapi;
grant select,insert on audit.record to zhudatuanprovisioningapi;
grant select on audit.accessrecord,audit.archiveref to zhudatuanprovisioningapi;
grant select,insert on organization.organization,organization.unitclosure,organization.sourcebinding
  to zhudatuanprovisioningapi;
grant insert on catalog.pool,catalog.poolbinding to zhudatuanprovisioningapi;
grant select,insert on experience.application to zhudatuanprovisioningapi;
grant update(head_version_id,updated_at) on experience.application to zhudatuanprovisioningapi;
grant insert on experience.version,experience.binding to zhudatuanprovisioningapi;
grant execute on function identity.resolve_session(text),access.resolve_membership(text),
  access.membership_version(text),access.resolve_scope(text,text,text,text),
  capability.membership_operations(text) to zhudatuanprovisioningapi;

drop policy if exists zhudatuanprovisioningapi on runtime.schemaversion;
create policy zhudatuanprovisioningapi on runtime.schemaversion for select to zhudatuanprovisioningapi
  using(version in('20260821032000','20260821054000','20260901223000','20260902012000'));
drop policy if exists zhudatuanprovisioningapiselect on runtime.idempotency;
create policy zhudatuanprovisioningapiselect on runtime.idempotency for select to zhudatuanprovisioningapi using(true);
drop policy if exists zhudatuanprovisioningapiinsert on runtime.idempotency;
create policy zhudatuanprovisioningapiinsert on runtime.idempotency for insert to zhudatuanprovisioningapi with check(true);
drop policy if exists zhudatuanprovisioningapiupdate on runtime.idempotency;
create policy zhudatuanprovisioningapiupdate on runtime.idempotency for update to zhudatuanprovisioningapi using(true) with check(true);
drop policy if exists zhudatuanprovisioningapiinsert on runtime.outbox;
create policy zhudatuanprovisioningapiinsert on runtime.outbox for insert to zhudatuanprovisioningapi with check(true);

drop policy if exists zhudatuanprovisioningapiselect on access.decisionaudit;
create policy zhudatuanprovisioningapiselect on access.decisionaudit for select to zhudatuanprovisioningapi using(true);
drop policy if exists zhudatuanprovisioningapiinsert on access.decisionaudit;
create policy zhudatuanprovisioningapiinsert on access.decisionaudit for insert to zhudatuanprovisioningapi with check(true);

drop policy if exists zhudatuanprovisioningapi on risk.policy;
create policy zhudatuanprovisioningapi on risk.policy for select to zhudatuanprovisioningapi using(true);
drop policy if exists zhudatuanprovisioningapi on risk.policyversion;
create policy zhudatuanprovisioningapi on risk.policyversion for select to zhudatuanprovisioningapi using(true);
drop policy if exists zhudatuanprovisioningapi on risk.signal;
create policy zhudatuanprovisioningapi on risk.signal for select to zhudatuanprovisioningapi using(true);
drop policy if exists zhudatuanprovisioningapi on risk.listentry;
create policy zhudatuanprovisioningapi on risk.listentry for select to zhudatuanprovisioningapi using(true);
drop policy if exists zhudatuanprovisioningapiselect on risk.decision;
create policy zhudatuanprovisioningapiselect on risk.decision for select to zhudatuanprovisioningapi using(true);
drop policy if exists zhudatuanprovisioningapiinsert on risk.decision;
create policy zhudatuanprovisioningapiinsert on risk.decision for insert to zhudatuanprovisioningapi with check(true);
drop policy if exists zhudatuanprovisioningapiinsert on risk.case;
create policy zhudatuanprovisioningapiinsert on risk.case for insert to zhudatuanprovisioningapi with check(true);

drop policy if exists zhudatuanprovisioningapiselect on audit.record;
create policy zhudatuanprovisioningapiselect on audit.record for select to zhudatuanprovisioningapi using(true);
drop policy if exists zhudatuanprovisioningapiinsert on audit.record;
create policy zhudatuanprovisioningapiinsert on audit.record for insert to zhudatuanprovisioningapi with check(true);
drop policy if exists zhudatuanprovisioningapi on audit.accessrecord;
create policy zhudatuanprovisioningapi on audit.accessrecord for select to zhudatuanprovisioningapi using(true);
drop policy if exists zhudatuanprovisioningapi on audit.archiveref;
create policy zhudatuanprovisioningapi on audit.archiveref for select to zhudatuanprovisioningapi using(true);

drop policy if exists zhudatuanprovisioningapiselect on organization.organization;
create policy zhudatuanprovisioningapiselect on organization.organization for select to zhudatuanprovisioningapi using(true);
drop policy if exists zhudatuanprovisioningapiinsert on organization.organization;
create policy zhudatuanprovisioningapiinsert on organization.organization for insert to zhudatuanprovisioningapi with check(true);
drop policy if exists zhudatuanprovisioningapiselect on organization.unitclosure;
create policy zhudatuanprovisioningapiselect on organization.unitclosure for select to zhudatuanprovisioningapi using(true);
drop policy if exists zhudatuanprovisioningapiinsert on organization.unitclosure;
create policy zhudatuanprovisioningapiinsert on organization.unitclosure for insert to zhudatuanprovisioningapi with check(true);
drop policy if exists zhudatuanprovisioningapiselect on organization.sourcebinding;
create policy zhudatuanprovisioningapiselect on organization.sourcebinding for select to zhudatuanprovisioningapi using(true);
drop policy if exists zhudatuanprovisioningapiinsert on organization.sourcebinding;
create policy zhudatuanprovisioningapiinsert on organization.sourcebinding for insert to zhudatuanprovisioningapi with check(true);

drop policy if exists zhudatuanprovisioningapiinsert on catalog.pool;
create policy zhudatuanprovisioningapiinsert on catalog.pool for insert to zhudatuanprovisioningapi with check(true);
drop policy if exists zhudatuanprovisioningapiinsert on catalog.poolbinding;
create policy zhudatuanprovisioningapiinsert on catalog.poolbinding for insert to zhudatuanprovisioningapi with check(true);

drop policy if exists zhudatuanprovisioningapiselect on experience.application;
create policy zhudatuanprovisioningapiselect on experience.application for select to zhudatuanprovisioningapi using(true);
drop policy if exists zhudatuanprovisioningapiinsert on experience.application;
create policy zhudatuanprovisioningapiinsert on experience.application for insert to zhudatuanprovisioningapi with check(true);
drop policy if exists zhudatuanprovisioningapiupdate on experience.application;
create policy zhudatuanprovisioningapiupdate on experience.application for update to zhudatuanprovisioningapi using(true) with check(true);
drop policy if exists zhudatuanprovisioningapiinsert on experience.version;
create policy zhudatuanprovisioningapiinsert on experience.version for insert to zhudatuanprovisioningapi with check(true);
drop policy if exists zhudatuanprovisioningapiinsert on experience.binding;
create policy zhudatuanprovisioningapiinsert on experience.binding for insert to zhudatuanprovisioningapi with check(true);

insert into runtime.schemaversion(version,checksum)
values('20260902012000','3a36f65b55737f624fc3d717a8f8815685908eae0cdb57673aeb5ba465887995');

do $assert$
begin
  if not exists(select 1 from pg_roles where rolname='zhudatuanprovisioningapi'
      and not rolsuper and not rolcreatedb and not rolcreaterole and not rolinherit
      and not rolreplication and not rolbypassrls)
    or exists(select 1 from pg_auth_members membership
      where membership.roleid=to_regrole('zhudatuanprovisioningapi')
        or membership.member=to_regrole('zhudatuanprovisioningapi')) then
    raise exception 'MALL_PROVISIONING_ROLE_BOUNDARY_INVALID';
  end if;
  if not has_table_privilege('zhudatuanprovisioningapi','organization.organization','SELECT,INSERT')
    or has_table_privilege('zhudatuanprovisioningapi','organization.organization','UPDATE,DELETE')
    or not has_table_privilege('zhudatuanprovisioningapi','catalog.pool','INSERT')
    or has_table_privilege('zhudatuanprovisioningapi','catalog.pool','SELECT,UPDATE,DELETE')
    or not has_table_privilege('zhudatuanprovisioningapi','experience.application','SELECT,INSERT')
    or has_table_privilege('zhudatuanprovisioningapi','experience.application','UPDATE,DELETE')
    or not has_column_privilege('zhudatuanprovisioningapi','experience.application','head_version_id','UPDATE')
    or has_column_privilege('zhudatuanprovisioningapi','experience.application','scope_id','UPDATE')
    or has_table_privilege('zhudatuanprovisioningapi','identity.session','SELECT,INSERT,UPDATE,DELETE')
    or has_schema_privilege('zhudatuanprovisioningapi','ordering','USAGE')
    or has_schema_privilege('zhudatuanprovisioningapi','payment','USAGE')
    or has_schema_privilege('zhudatuanprovisioningapi','finance','USAGE') then
    raise exception 'MALL_PROVISIONING_ROLE_PRIVILEGE_INVALID';
  end if;
  if not has_function_privilege('zhudatuanprovisioningapi','identity.resolve_session(text)','EXECUTE')
    or not has_function_privilege('zhudatuanprovisioningapi','access.resolve_scope(text,text,text,text)','EXECUTE')
    or not has_function_privilege('zhudatuanprovisioningapi','capability.membership_operations(text)','EXECUTE') then
    raise exception 'MALL_PROVISIONING_ROLE_FUNCTION_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260902012000'
      and checksum='3a36f65b55737f624fc3d717a8f8815685908eae0cdb57673aeb5ba465887995') then
    raise exception 'MALL_PROVISIONING_ROLE_LEDGER_MISSING';
  end if;
end
$assert$;

commit;
