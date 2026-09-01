\set ON_ERROR_STOP on

begin;

select pg_advisory_xact_lock(hashtext('production:acceptance-owner-credential-recovery:20260902:v1'));

create temporary table pg_temp.credentialrecovery (
  subject_hash text not null check (subject_hash ~ '^[a-f0-9]{64}$'),
  secret_hash text not null check (
    secret_hash ~ '^scrypt\$v1\$32768\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$'
  )
) on commit drop;

insert into pg_temp.credentialrecovery values (:'subject_hash', :'secret_hash');

do $recovery$
declare
  v_principal constant text := 'principal:zhudatuan:owner:production:v1';
  v_credential constant text := 'credential:password:zhudatuan-owner-production:v1';
  v_audit constant text := 'audit:production:acceptance-owner-credential-recovery:20260902:v1';
  v_old_subject text;
  v_old_secret text;
  v_new_subject text;
  v_new_secret text;
  v_previous_hash text;
  v_before_hash text;
  v_after_hash text;
  v_record_hash text;
  v_recorded_at timestamptz;
  v_before_version bigint;
  v_after_version bigint;
  v_revoked_sessions integer;
  v_cleared_attempts integer;
begin
  if exists (select 1 from audit.record where id = v_audit) then
    raise exception 'ACCEPTANCE_CREDENTIAL_RECOVERY_ALREADY_APPLIED';
  end if;

  select credential.subject_hash, credential.secret_hash
  into v_old_subject, v_old_secret
  from identity.credential credential
  where credential.id = v_credential
    and credential.principal_id = v_principal
    and credential.provider = 'password'
    and credential.status = 'active'
  for update;

  if v_old_subject is null or v_old_secret is null then
    raise exception 'ACCEPTANCE_OWNER_PASSWORD_CREDENTIAL_MISSING';
  end if;

  select recovery.subject_hash, recovery.secret_hash
  into strict v_new_subject, v_new_secret
  from pg_temp.credentialrecovery recovery;

  select principal.credential_version
  into v_before_version
  from identity.principal principal
  where principal.id = v_principal and principal.status = 'active'
  for update;

  if v_before_version is null then
    raise exception 'ACCEPTANCE_OWNER_PRINCIPAL_MISSING';
  end if;

  update identity.credential credential
  set subject_hash = v_new_subject,
      secret_hash = v_new_secret,
      rotated_at = clock_timestamp()
  where credential.id = v_credential;

  update identity.principal principal
  set credential_version = principal.credential_version + 1,
      version = principal.version + 1,
      updated_at = clock_timestamp()
  where principal.id = v_principal
  returning principal.credential_version into v_after_version;

  update identity.session session
  set revoked_at = coalesce(session.revoked_at, clock_timestamp()),
      revoked_reason = coalesce(session.revoked_reason, 'acceptance_credential_recovered')
  where session.principal_id = v_principal and session.revoked_at is null;
  get diagnostics v_revoked_sessions = row_count;

  delete from identity.loginattempt attempt where attempt.subject_hash = v_new_subject;
  get diagnostics v_cleared_attempts = row_count;

  select chain.record_hash
  into v_previous_hash
  from (
    select record.record_hash, record.recorded_at occurred_at, record.id
    from audit.record record where record.scope_id = 'tenant-zhudatuan'
    union all
    select accessrecord.record_hash, accessrecord.accessed_at, accessrecord.id
    from audit.accessrecord accessrecord where accessrecord.scope_id = 'tenant-zhudatuan'
    union all
    select archive.last_record_hash, archive.through_at, archive.id
    from audit.archiveref archive where archive.scope_id = 'tenant-zhudatuan'
  ) chain
  order by chain.occurred_at desc, chain.id desc
  limit 1;

  v_recorded_at := clock_timestamp();
  v_before_hash := encode(public.digest(v_old_subject || ':' || v_old_secret, 'sha256'), 'hex');
  v_after_hash := encode(public.digest(v_new_subject || ':' || v_new_secret, 'sha256'), 'hex');
  v_record_hash := encode(
    public.digest(v_audit || ':' || coalesce(v_previous_hash, '') || ':' || v_after_hash || ':' || v_recorded_at::text, 'sha256'),
    'hex'
  );

  insert into audit.record (
    id, scope_id, actor_id, actor_type, action, resource_type, resource_id,
    before_hash, after_hash, evidence, trace_id, previous_hash, record_hash, recorded_at
  ) values (
    v_audit, 'tenant-zhudatuan', 'codex-production-acceptance', 'system',
    'identity.credential.recovered', 'identity.credential', v_credential,
    v_before_hash, v_after_hash,
    jsonb_build_object(
      'userAuthorized', true,
      'purpose', 'production-mvp-acceptance',
      'username', 'ethan',
      'principal', v_principal,
      'credentialVersionBefore', v_before_version,
      'credentialVersionAfter', v_after_version,
      'revokedSessions', v_revoked_sessions,
      'clearedLoginAttempts', v_cleared_attempts,
      'plaintextStored', false
    ),
    'production-acceptance:20260902', v_previous_hash, v_record_hash, v_recorded_at
  );

  if v_after_version <> v_before_version + 1
    or not exists (
      select 1
      from identity.credential credential
      where credential.id = v_credential
        and credential.principal_id = v_principal
        and credential.provider = 'password'
        and credential.status = 'active'
        and credential.subject_hash = v_new_subject
        and credential.secret_hash = v_new_secret
    )
  then
    raise exception 'ACCEPTANCE_CREDENTIAL_RECOVERY_ASSERTION_FAILED';
  end if;
end
$recovery$;

commit;

select
  principal.id,
  principal.status,
  principal.credential_version,
  credential.provider,
  credential.status credential_status,
  split_part(credential.secret_hash, '$', 1) algorithm,
  length(credential.secret_hash) secret_hash_length,
  exists (
    select 1 from audit.record
    where id = 'audit:production:acceptance-owner-credential-recovery:20260902:v1'
  ) audited
from identity.principal principal
join identity.credential credential on credential.principal_id = principal.id
where principal.id = 'principal:zhudatuan:owner:production:v1'
  and credential.provider = 'password';
