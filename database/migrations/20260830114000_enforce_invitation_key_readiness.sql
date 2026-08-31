begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830113000') then
    raise exception 'INVITATION_KEY_READINESS_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830114000') then
    raise exception 'INVITATION_KEY_READINESS_ALREADY_APPLIED';
  end if;
end $precondition$;

create function identity.invitation_key_readiness(active_versions text[])
returns table(active_count bigint,missing_count bigint)
language sql stable security definer set search_path=pg_catalog,pg_temp as $function$
  select count(*)::bigint,
    count(*) filter(where not invitation.token_key_version=any(active_versions))::bigint
  from identity.invitation invitation
  where invitation.status='active' and invitation.expires_at>clock_timestamp()
$function$;
revoke all on function identity.invitation_key_readiness(text[]) from public;
grant execute on function identity.invitation_key_readiness(text[]) to shopapp,shopjob;

select runtime.record_migration_evidence('20260830114000',1,1,0,0,
  'create index concurrently if not exists identity_invitation_key_readiness_live on identity.invitation(token_key_version,expires_at) where status=''active'';',
  'select * from identity.invitation_key_readiness(array[''current-version'']);');
insert into runtime.schemaversion(version,checksum)
values('20260830114000',encode(public.digest('20260830114000_enforce_invitation_key_readiness','sha256'),'hex'));

do $assert$ begin
  if has_function_privilege('public','identity.invitation_key_readiness(text[])','EXECUTE') then
    raise exception 'INVITATION_KEY_READINESS_PUBLIC_EXECUTE';
  end if;
  if not has_function_privilege('shopapp','identity.invitation_key_readiness(text[])','EXECUTE')
    or not has_function_privilege('shopjob','identity.invitation_key_readiness(text[])','EXECUTE') then
    raise exception 'INVITATION_KEY_READINESS_WORKLOAD_EXECUTE_MISSING';
  end if;
end $assert$;

commit;
