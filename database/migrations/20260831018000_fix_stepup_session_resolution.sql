begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260831017000') then
    raise exception 'STEPUP_SESSION_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831018000') then
    raise exception 'STEPUP_SESSION_ALREADY_APPLIED';
  end if;
end
$precondition$;

-- A successful mobile step-up is itself the fresh AAL3 evidence. Requiring a
-- second, exactly-level-2 phone record makes password sessions impossible to
-- elevate even though the step-up challenge was delivered to that same phone.
create or replace function identity.resolve_session(p_token_hash text)
returns table(
  actor_id text,
  session_id text,
  membership_id text,
  credential_version bigint,
  access_version bigint,
  target text,
  assurance_level smallint,
  assurance_verified_at timestamptz
)
language sql stable security definer
set search_path=identity,member,access,pg_temp as $function$
  select session.principal_id,session.id,session.membership_id,session.credential_version,session.access_version,
    case session.client when 'operator' then 'console' else session.client end,
    case
      when session.assurance_level>=3 and stepup.verified_at is not null then 3::smallint
      when session.assurance_level>=2 and phone.verified_at is not null then 2::smallint
      else 1::smallint
    end,
    case when session.assurance_level>=3 and stepup.verified_at is not null then stepup.verified_at else null end
  from identity.session session
  join identity.principal principal on principal.id=session.principal_id
  join member.profile profile on profile.principal_id=session.principal_id
  join access.membership membership on membership.id=session.membership_id and membership.member_id=profile.id
  left join lateral (
    select evidence.verified_at from identity.assurance evidence
    where evidence.principal_id=session.principal_id and evidence.method='phone_otp' and evidence.level=2
      and evidence.verified_at<=clock_timestamp() and evidence.expires_at>clock_timestamp()
    order by evidence.verified_at desc limit 1
  ) phone on true
  left join lateral (
    select evidence.verified_at from identity.assurance evidence
    where evidence.principal_id=session.principal_id and evidence.level>=3
      and evidence.verified_at<=clock_timestamp() and (evidence.expires_at is null or evidence.expires_at>clock_timestamp())
    order by evidence.level desc,evidence.verified_at desc limit 1
  ) stepup on true
  where session.token_hash=p_token_hash and session.revoked_at is null and session.expires_at>clock_timestamp()
    and session.credential_version=principal.credential_version and principal.status='active' and membership.status='active'
$function$;

update capability.operation
set audience='console'
where operation_id='catalog.listings.read' and audience<>'console';

update runtime.contractcatalog
set checksum='2d179f54b48381541fcc3df2b1b016742c901e12213816415b3f5e54f65d0285',
  operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event),
  published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260831018000',1,1,0,0,
  'select identity.resolve_session($1);',
  'select version,checksum from runtime.schemaversion where version=''20260831018000'';'
);

insert into runtime.schemaversion(version,checksum)
values('20260831018000','2d179f54b48381541fcc3df2b1b016742c901e12213816415b3f5e54f65d0285');

do $assert$
begin
  if to_regprocedure('identity.resolve_session(text)') is null then
    raise exception 'STEPUP_SESSION_RESOLVER_MISSING';
  end if;
  if not exists(select 1 from runtime.schemaversion where version='20260831018000'
    and checksum='2d179f54b48381541fcc3df2b1b016742c901e12213816415b3f5e54f65d0285') then
    raise exception 'STEPUP_SESSION_HEAD_MISSING';
  end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='3.0.0'
    and status='active' and checksum='2d179f54b48381541fcc3df2b1b016742c901e12213816415b3f5e54f65d0285') then
    raise exception 'STEPUP_SESSION_CONTRACT_IDENTITY_INVALID';
  end if;
  if not exists(select 1 from capability.operation where operation_id='catalog.listings.read' and audience='console') then
    raise exception 'CATALOG_LISTING_CONSOLE_AUDIENCE_INVALID';
  end if;
end
$assert$;

commit;
