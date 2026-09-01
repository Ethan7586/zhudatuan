begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260902010000') then
    raise exception 'EXPERIENCE_DETAIL_CAPABILITY_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260902011000') then
    raise exception 'EXPERIENCE_DETAIL_CAPABILITY_ALREADY_APPLIED';
  end if;
  if not exists(
    select 1
    from runtime.operation operation
    join capability.operation binding on binding.operation_id=operation.id
    join capability.capability capability on capability.id=binding.capability_id
    where operation.id='experience.applications.detail.read'
      and operation.method='GET'
      and operation.path='/api/v1/experiences/applications/{applicationid}'
      and binding.permission_code='experience.application.read'
      and binding.audience='console'
      and capability.status='active'
  ) then
    raise exception 'EXPERIENCE_DETAIL_CAPABILITY_CONTRACT_MISSING';
  end if;
end $precondition$;

insert into capability.entitlement(
  id,scope_id,capability_id,state,quota,effective_at,expires_at,version
)
values(
  'platform:experience.applications.detail.read',
  'organization-platform-root',
  'experience.applications.detail.read',
  'enabled',null,'1970-01-01T00:00:00Z',null,0
);

select runtime.record_migration_evidence(
  '20260902011000',1,1,0,0,
  'select id,scope_id,capability_id,state,effective_at,expires_at,version from capability.entitlement where id=''platform:experience.applications.detail.read'';',
  'select membership.id from access.membership membership where exists(select 1 from capability.membership_operations(membership.id) available where available.operation_id=''experience.applications.read'') and not exists(select 1 from capability.membership_operations(membership.id) available where available.operation_id=''experience.applications.detail.read'');'
);

insert into runtime.schemaversion(version,checksum)
values(
  '20260902011000',
  encode(public.digest('20260902011000_enable_experience_detail_capability','sha256'),'hex')
);

do $assert$ begin
  if not exists(
    select 1 from capability.entitlement
    where id='platform:experience.applications.detail.read'
      and scope_id='organization-platform-root'
      and capability_id='experience.applications.detail.read'
      and state='enabled'
      and quota is null
      and effective_at='1970-01-01T00:00:00Z'
      and expires_at is null
  ) then
    raise exception 'EXPERIENCE_DETAIL_CAPABILITY_ENTITLEMENT_INVALID';
  end if;

  if exists(
    select 1
    from access.membership membership
    where exists(
      select 1 from capability.membership_operations(membership.id) available
      where available.operation_id='experience.applications.read'
    )
      and not exists(
        select 1 from capability.membership_operations(membership.id) available
        where available.operation_id='experience.applications.detail.read'
      )
  ) then
    raise exception 'EXPERIENCE_DETAIL_CAPABILITY_CLOSURE_INVALID';
  end if;
end $assert$;

commit;
