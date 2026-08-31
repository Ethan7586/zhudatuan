begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831026000') then
    raise exception 'MEMBER_ACCESS_WORKSPACE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831027000') then
    raise exception 'MEMBER_ACCESS_WORKSPACE_ALREADY_APPLIED';
  end if;
  if (select count(*) from runtime.operation where id in('identity.members.manage','access.roles.manage','access.overrides.manage','access.scopes.manage'))<>4 then
    raise exception 'MEMBER_ACCESS_COMMAND_SET_INCOMPLETE';
  end if;
  if exists(select 1 from access.scopegrant group by membership_id,scope_kind,scope_id
    having count(distinct effect)>1 or count(distinct coalesce(expires_at,'infinity'::timestamptz))>1) then
    raise exception 'CONFLICTING_SCOPE_GRANT_REQUIRES_REVIEW';
  end if;
end $precondition$;

select runtime.record_migration_evidence('20260831027000',0,0,0,0,
  'select id,client,status,access_version from access.membership order by id;',
  'select role.id,role.kind,role.version,mapping.permission_id,mapping.effect from access.role role left join access.rolepermission mapping on mapping.role_id=role.id order by role.id,mapping.permission_id;');
with ranked as (
  select id,row_number() over(partition by membership_id,scope_kind,scope_id order by effective_at,id) position
  from access.scopegrant
)
delete from access.scopegrant scopegrant using ranked where scopegrant.id=ranked.id and ranked.position>1;
alter table access.scopegrant add constraint access_scopegrant_target_unique unique(membership_id,scope_kind,scope_id);
insert into runtime.schemaversion(version,checksum)
values('20260831027000','9d25803290be248ccb3fbc10cd4abd3c5df31991c1c8023aff1abb60536bc203');

commit;
