begin;

select pg_advisory_xact_lock(hashtext('identity:notification-node-routing:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260909061000'
        and checksum='c991df2e1432618d6f39763476e8473588891269231fe01373877422e3a7c6ba')
    or exists(select 1 from runtime.schemaversion where version>'20260909061000') then
    raise exception 'IDENTITY_NOTIFICATION_NODE_ROUTING_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

create or replace function runtime.claim_identity_notification_job(
  p_owner text,p_limit integer,p_lease_seconds integer
) returns setof runtime.job
language plpgsql security definer set search_path=runtime,pg_temp as $claim$
begin
  if session_user<>'zhudatuanidentityjob' or p_owner!~'^[A-Za-z0-9][A-Za-z0-9:._-]{2,127}$'
    or p_limit not between 1 and 20 or p_lease_seconds not between 5 and 120 then
    raise exception 'IDENTITY_NOTIFICATION_JOB_CLAIM_INVALID';
  end if;
  return query
  with candidates as(
    select id from runtime.job where kind='identitynotification' and owner='identity'
      and (scope_id is null or scope_id not like 'node:%')
      and ((state='queued' and available_at<=clock_timestamp())
        or (state='running' and lease_deadline<=clock_timestamp()))
    order by priority,available_at,id for update skip locked limit p_limit
  ) update runtime.job target set state='running',lease_owner=p_owner,
      lease_deadline=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempts=target.attempts+1,
      updated_at=clock_timestamp()
    from candidates where target.id=candidates.id returning target.*;
end
$claim$;

revoke all on function runtime.claim_identity_notification_job(text,integer,integer) from public,shopapp,shopjob;
grant execute on function runtime.claim_identity_notification_job(text,integer,integer) to zhudatuanidentityjob;

insert into runtime.schemaversion(version,checksum)
values('20260909160000','df4d4ababaae25423beace3342453ac88443d051f7415d605956438cf94e66b8');

do $assert$
begin
  if position('node:%' in pg_get_functiondef('runtime.claim_identity_notification_job(text,integer,integer)'::regprocedure))=0
    or not has_function_privilege('zhudatuanidentityjob','runtime.claim_identity_notification_job(text,integer,integer)','EXECUTE')
    or not exists(select 1 from runtime.schemaversion
      where version='20260909160000'
        and checksum='df4d4ababaae25423beace3342453ac88443d051f7415d605956438cf94e66b8') then
    raise exception 'IDENTITY_NOTIFICATION_NODE_ROUTING_MIGRATION_INCOMPLETE';
  end if;
end
$assert$;

commit;
