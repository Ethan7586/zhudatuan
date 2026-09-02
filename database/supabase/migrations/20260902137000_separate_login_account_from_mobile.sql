begin;

do $dependency$
begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260902136000'
      and checksum='25bb76e927ff030bd4eb7e2a99bf38196495fe82b32db52d6017ca8d7d75e4af') then
    raise exception 'LOGIN_ACCOUNT_MOBILE_SEPARATION_DEPENDENCY_MISSING';
  end if;
end
$dependency$;

do $rewrite$
declare
  target constant regprocedure :=
    'access.change_zhudatuan_owner_mobile(text,text,text,text,text,text,text,text,text)'::regprocedure;
  definition text;
  rewritten text;
  credential_rewrite constant text :=
    'update[[:space:]]+identity[.]credential[[:space:]]+set[[:space:]]+subject_hash[[:space:]]*=[[:space:]]*p_subject_hash[[:space:]]*,[[:space:]]*rotated_at[[:space:]]*=[[:space:]]*changed_at[[:space:]]+where[[:space:]]+id[[:space:]]*=[[:space:]]*owner_credential[[:space:]]*;';
begin
  select pg_get_functiondef(target) into definition;
  if regexp_count(definition,credential_rewrite,1,'i')<>1 then
    raise exception 'OWNER_MOBILE_CREDENTIAL_REWRITE_SOURCE_INVALID';
  end if;
  rewritten:=regexp_replace(definition,credential_rewrite,'','i');
  if rewritten=definition or regexp_count(rewritten,credential_rewrite,1,'i')<>0 then
    raise exception 'OWNER_MOBILE_CREDENTIAL_REWRITE_FAILED';
  end if;
  execute rewritten;
end
$rewrite$;

do $restore$
declare
  bootstrap_count integer;
  original_principal text;
  original_subject text;
  restored_count integer;
begin
  select count(*)::integer into bootstrap_count
  from audit.record
  where action='identity.owner.bootstrapped'
    and evidence->>'bootstrap'='zhudatuan-owner-v1';

  if bootstrap_count=0 then
    return;
  end if;
  if bootstrap_count<>1 then
    raise exception 'OWNER_BOOTSTRAP_SUBJECT_EVIDENCE_AMBIGUOUS';
  end if;

  select evidence->>'principal',evidence->>'subjectFingerprint'
  into original_principal,original_subject
  from audit.record
  where action='identity.owner.bootstrapped'
    and evidence->>'bootstrap'='zhudatuan-owner-v1';

  if original_principal is null or original_principal=''
    or original_subject is null or original_subject!~'^[0-9a-f]{64}$' then
    raise exception 'OWNER_BOOTSTRAP_SUBJECT_EVIDENCE_INVALID';
  end if;
  if exists(select 1 from identity.credential
    where provider='password' and subject_hash=original_subject
      and principal_id<>original_principal and status='active') then
    raise exception 'OWNER_BOOTSTRAP_SUBJECT_COLLISION';
  end if;

  update identity.credential credential
  set subject_hash=original_subject
  where credential.principal_id=original_principal
    and credential.provider='password'
    and credential.status='active'
    and credential.subject_hash<>original_subject
    and exists(select 1 from identity.assurance assurance
      where assurance.principal_id=original_principal
        and assurance.method='phone_otp'
        and assurance.evidence_hash=credential.subject_hash);
  get diagnostics restored_count=row_count;
  if restored_count>1 then
    raise exception 'OWNER_BOOTSTRAP_SUBJECT_RESTORE_AMBIGUOUS';
  end if;

  if exists(select 1
    from identity.credential credential
    where credential.principal_id=original_principal
      and credential.provider='password'
      and credential.status='active'
      and credential.subject_hash<>original_subject
      and exists(select 1 from identity.assurance assurance
        where assurance.principal_id=original_principal
          and assurance.method='phone_otp'
          and assurance.evidence_hash=credential.subject_hash)) then
    raise exception 'OWNER_BOOTSTRAP_SUBJECT_RESTORE_FAILED';
  end if;
end
$restore$;

insert into runtime.schemaversion(version,checksum)
values('20260902137000','e2de98bbb02b89ae2a017bb83295c3dc24ffb74dc9dcdf76891ed587d6b4ed5e');

do $assert$
declare
  definition text;
begin
  select pg_get_functiondef(
    'access.change_zhudatuan_owner_mobile(text,text,text,text,text,text,text,text,text)'::regprocedure
  ) into definition;
  if definition ~* 'update[[:space:]]+identity[.]credential[[:space:]]+set[[:space:]]+subject_hash'
    or not has_function_privilege(
      'zhudatuanidentityapi',
      'access.change_zhudatuan_owner_mobile(text,text,text,text,text,text,text,text,text)',
      'EXECUTE'
    ) then
    raise exception 'LOGIN_ACCOUNT_MOBILE_SEPARATION_BOUNDARY_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260902137000'
      and checksum='e2de98bbb02b89ae2a017bb83295c3dc24ffb74dc9dcdf76891ed587d6b4ed5e') then
    raise exception 'LOGIN_ACCOUNT_MOBILE_SEPARATION_LEDGER_MISSING';
  end if;
end
$assert$;

commit;
