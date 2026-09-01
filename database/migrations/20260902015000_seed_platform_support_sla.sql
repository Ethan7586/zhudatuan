begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260902014000') then
    raise exception 'PLATFORM_SUPPORT_SLA_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260902015000') then
    raise exception 'PLATFORM_SUPPORT_SLA_ALREADY_APPLIED';
  end if;
  if not exists(
    select 1
    from organization.organization
    where id='organization-platform-root' and kind='platform' and status='active'
  ) then
    raise exception 'PLATFORM_SUPPORT_SLA_ROOT_MISSING';
  end if;
end
$precondition$;

insert into support.sla(id,scope_id,priority,response_seconds,resolution_seconds,version)
values
  ('sla:platform:low:v1','organization-platform-root','low',28800,259200,1),
  ('sla:platform:normal:v1','organization-platform-root','normal',14400,172800,1),
  ('sla:platform:high:v1','organization-platform-root','high',3600,86400,1),
  ('sla:platform:urgent:v1','organization-platform-root','urgent',900,14400,1)
on conflict do nothing;

select runtime.record_migration_evidence(
  '20260902015000',4,4,0,0,
  'select id,scope_id,priority,response_seconds,resolution_seconds,version from support.sla where scope_id=''organization-platform-root'' order by priority,version;',
  'select organization.id,priority.value from organization.organization cross join (values(''low''),(''normal''),(''high''),(''urgent'')) priority(value) where organization.status=''active'' and exists(select 1 from organization.unitclosure closure join support.sla sla on sla.scope_id=closure.ancestor_id and sla.priority=priority.value where closure.descendant_id=organization.id);'
);

insert into runtime.schemaversion(version,checksum)
values(
  '20260902015000',
  encode(public.digest('20260902015000_seed_platform_support_sla','sha256'),'hex')
);

do $assert$
begin
  if exists(
    select 1
    from organization.organization organization
    cross join (values('low'),('normal'),('high'),('urgent')) priority(value)
    where organization.status='active'
      and not exists(
        select 1
        from organization.unitclosure closure
        join support.sla sla on sla.scope_id=closure.ancestor_id and sla.priority=priority.value
        where closure.descendant_id=organization.id
      )
  ) then
    raise exception 'PLATFORM_SUPPORT_SLA_INHERITANCE_INVALID';
  end if;
end
$assert$;

commit;
