begin;

-- A departed OP remains a historical Membership; a later invitation creates
-- a different Membership (and therefore a different, never-reused OP code).
alter table access.membership drop constraint membership_member_id_organization_id_client_key;
create unique index membership_nonoperator_subject_unique
  on access.membership(member_id,organization_id,client) where client<>'operator';
create unique index membership_current_operator_subject_unique
  on access.membership(member_id,organization_id,client)
  where client='operator' and status<>'left';

-- The import RPC previously targeted the dropped three-column constraint.
-- Keep its deterministic-ID and collision behavior, using the primary key.
create or replace function access.ensure_imported_membership(
  p_membership text,p_member text,p_organization text,p_client text,p_employee text
) returns void language plpgsql security definer
set search_path=pg_catalog,pg_temp
set row_security=off as $function$
declare expected_hash text; saved_membership text;
begin
  expected_hash:=encode(public.digest(p_organization||':'||p_employee,'sha256'),'hex');
  if (session_user<>'shopjob' and coalesce(current_setting('role',true),'')<>'shopjob')
    or current_setting('app.workload',true)<>'jobs'
    or nullif(current_setting('app.scope_id',true),'') is distinct from p_organization
    or p_client not in('storefront','operator','store','supplier')
    or length(p_employee) not between 1 and 128 or btrim(p_employee)<>p_employee
    or p_member<>'member:import:'||expected_hash
    or p_membership<>'membership:import:'||expected_hash||':'||p_client
    or not exists(select 1 from organization.organization organization
      where organization.id=p_organization and organization.status='active') then
    raise exception 'MEMBER_IMPORT_MEMBERSHIP_FORBIDDEN';
  end if;
  perform pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'));
  if access.zhudatuan_protected_identity(p_membership,p_member,null,null) then
    raise exception 'MEMBER_IMPORT_PROTECTED_IDENTITY';
  end if;
  if not exists(select 1 from member.profile profile where profile.id=p_member
      and profile.principal_id='principal:import:'||expected_hash
      and profile.status in('pending','active')) then
    raise exception 'MEMBER_IMPORT_PROFILE_INVALID';
  end if;
  begin
    insert into access.membership(id,member_id,organization_id,client,employee_no,status,access_version)
    values(p_membership,p_member,p_organization,p_client,p_employee,'invited',1)
    on conflict(id) do update set employee_no=excluded.employee_no
    where access.membership.member_id=excluded.member_id
      and access.membership.organization_id=excluded.organization_id
      and access.membership.client=excluded.client
    returning id into saved_membership;
  exception when unique_violation then
    raise exception 'MEMBER_IMPORT_IDENTITY_COLLISION';
  end;
  if saved_membership is distinct from p_membership then
    raise exception 'MEMBER_IMPORT_IDENTITY_COLLISION';
  end if;
end
$function$;

insert into runtime.schemaversion(version,checksum)
values('20260917140000',encode(public.digest('operator-reinvitation-lifecycle:v1','sha256'),'hex'));

commit;
