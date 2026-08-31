begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830127000') then
    raise exception 'AUTHORIZATION_SNAPSHOT_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830128000') then
    raise exception 'AUTHORIZATION_SNAPSHOT_ALREADY_APPLIED';
  end if;
end $precondition$;

drop function access.consume_action_proof(bytea,text,text,text,bigint,text,text,text,text);
drop function access.authorization_snapshot(text,text,text,text);

create function access.authorization_snapshot(
  p_membership_id text,p_target text,p_operation text,p_resource text
)
returns table(
  membership_id text,membership_active boolean,access_version bigint,credential_version bigint,
  organization_id text,target text,role_assignments jsonb,
  permission_allows text[],permission_denies text[],scopes jsonb,resource_scope jsonb,
  operation_ids text[],capability_version bigint
)
language sql stable security definer
set search_path=access,capability,identity,pg_temp as $function$
  with subject as materialized (
    select membership.id,membership.status='active' and principal.status='active' active,
      membership.access_version,principal.credential_version,membership.organization_id,
      case membership.client when 'operator' then 'console' else membership.client end target
    from access.membership membership
    join identity.principal principal on principal.id=membership.principal_id
    where membership.id=p_membership_id
      and case membership.client when 'operator' then 'console' else membership.client end=p_target
  ), roles as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',role.id,'kind',role.kind,'status',role.status,'version',role.version,
      'effectiveAt',assignment.effective_at,'expiresAt',assignment.expires_at,
      'active',role.status='active' and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()))
      order by role.id,assignment.effective_at),'[]'::jsonb) value
    from access.membershiprole assignment
    join access.role role on role.id=assignment.role_id
    where assignment.membership_id=p_membership_id
  ), permissions as materialized (
    select permission_code,effect from access.effective_permissions(p_membership_id)
  ), permission_set as (
    select coalesce(array_agg(permission_code order by permission_code)
      filter(where effect='allow'),'{}'::text[]) allows,
      coalesce(array_agg(permission_code order by permission_code)
      filter(where effect='deny'),'{}'::text[]) denies
    from permissions
  ), scope_set as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'scope',scope,'effect',effect,'effective',effective_at,'expires',expires_at)
      order by effect,scope->>'kind',scope->>'id'),'[]'::jsonb) value
    from access.effective_scopes(p_membership_id)
  ), capability_set as (
    select available.operation_ids,available.capability_version
    from capability.membership_authorization(p_membership_id) available
  )
  select subject.id,subject.active,subject.access_version,subject.credential_version,
    subject.organization_id,subject.target,roles.value,permission_set.allows,permission_set.denies,scope_set.value,
    access.scope_object(access.resource_scope(p_operation,p_resource,p_membership_id)),
    capability_set.operation_ids,capability_set.capability_version
  from subject cross join roles cross join permission_set cross join scope_set cross join capability_set
$function$;

create function access.consume_action_proof(
  p_token_hash bytea,p_operation text,p_resource text,p_request_hash text,p_expected_version bigint,
  p_target text,p_scope text,p_maker_membership text,p_permission text
)
returns table(proof_id text,checker_membership_id text)
language plpgsql volatile security definer set search_path=access,capability,pg_temp as $function$
declare proof access.actionproof%rowtype; snapshot record;
begin
  select * into proof from access.actionproof candidate where candidate.token_hash=p_token_hash for update;
  if proof.id is null then raise exception 'ACTION_PROOF_INVALID'; end if;
  if proof.consumed_at is not null then raise exception 'ACTION_PROOF_REPLAYED'; end if;
  if proof.expires_at<=clock_timestamp() then raise exception 'ACTION_PROOF_INVALID'; end if;
  if proof.operation_id<>p_operation or proof.resource_id<>p_resource or proof.request_hash<>p_request_hash
    or proof.expected_version is distinct from p_expected_version or proof.target<>p_target or proof.scope_id<>p_scope
    or proof.maker_membership_id<>p_maker_membership or proof.permission_code<>p_permission then
    raise exception 'ACTION_PROOF_INVALID';
  end if;
  if proof.checker_membership_id=proof.maker_membership_id then raise exception 'MAKER_CHECKER_SEPARATION_REQUIRED'; end if;

  select * into snapshot from access.authorization_snapshot(
    proof.checker_membership_id,proof.target,proof.operation_id,proof.resource_id);
  if snapshot.membership_id is null or not snapshot.membership_active
    or snapshot.access_version<>proof.checker_access_version
    or proof.permission_code=any(snapshot.permission_denies)
    or not proof.permission_code=any(snapshot.permission_allows)
    or not proof.operation_id=any(snapshot.operation_ids)
    or snapshot.resource_scope->>'id'<>proof.scope_id then
    raise exception 'ACTION_PROOF_INVALID';
  end if;

  update access.actionproof consumed set consumed_at=clock_timestamp() where consumed.id=proof.id;
  return query select proof.id::text,proof.checker_membership_id;
end
$function$;

revoke all on function access.authorization_snapshot(text,text,text,text),
  access.consume_action_proof(bytea,text,text,text,bigint,text,text,text,text) from public;
grant execute on function access.authorization_snapshot(text,text,text,text),
  access.consume_action_proof(bytea,text,text,text,bigint,text,text,text,text) to shopapp;

select runtime.record_migration_evidence('20260830128000',0,0,0,0,
  'select access.authorization_snapshot(id,case client when ''operator'' then ''console'' else client end,''identity.session.read'',null) from access.membership where status=''active'';',
  'select count(*) active_memberships from access.membership where status=''active'';');
insert into runtime.schemaversion(version,checksum)
values('20260830128000',encode(public.digest('20260830128000_complete_authorization_snapshot','sha256'),'hex'));

do $assert$ begin
  if pg_get_function_result('access.authorization_snapshot(text,text,text,text)'::regprocedure)
    not like '%credential_version%organization_id%target%role_assignments%' then
    raise exception 'AUTHORIZATION_SNAPSHOT_REQUIRED_FIELDS_MISSING';
  end if;
  if to_regprocedure('access.consume_action_proof(bytea,text,text,text,bigint,text,text,text,text)') is null then
    raise exception 'ACTION_PROOF_CONSUMER_MISSING';
  end if;
end $assert$;

commit;
