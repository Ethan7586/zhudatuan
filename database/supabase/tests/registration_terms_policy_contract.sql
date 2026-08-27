begin;

do $$
declare
  canonical_policy jsonb;
  result jsonb;
  attempts_before bigint;
begin
  if (select count(*) from public.registration_terms_policy)<>1 then
    raise exception 'CONTRACT_REGISTRATION_TERMS_NOT_SINGLETON';
  end if;
  canonical_policy:=public.api_registration_terms();
  if canonical_policy->>'version' is distinct from '2026-08-13'
     or canonical_policy->>'version' is distinct from (
       select terms_version from public.registration_terms_policy where singleton
     )
     or length(canonical_policy#>>'{terms,body}')=0
     or length(canonical_policy#>>'{privacy,body}')=0
  then raise exception 'CONTRACT_REGISTRATION_TERMS_PROJECTION_INVALID'; end if;

  if not (select relrowsecurity from pg_class where oid='public.registration_terms_policy'::regclass)
     or exists(
       select 1 from pg_policies
       where schemaname='public' and tablename='registration_terms_policy'
     )
     or has_table_privilege('service_role','public.registration_terms_policy','select')
     or has_table_privilege('service_role','public.registration_terms_policy','insert')
     or has_table_privilege('service_role','public.registration_terms_policy','update')
     or has_table_privilege('service_role','public.registration_terms_policy','delete')
     or has_table_privilege('anon','public.registration_terms_policy','select')
     or has_table_privilege('authenticated','public.registration_terms_policy','select')
  then raise exception 'CONTRACT_REGISTRATION_TERMS_TABLE_ACL_INVALID'; end if;
  if not has_function_privilege(
       'service_role','public.api_registration_terms()','execute'
     )
     or has_function_privilege(
       'anon','public.api_registration_terms()','execute'
     )
     or has_function_privilege(
       'authenticated','public.api_registration_terms()','execute'
     )
     or to_regprocedure('public.api_registration_terms_version()') is not null
     or not has_function_privilege(
       'service_role',
       'public.api_register_username_member(text,text,text,text,text,text,text,text)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.api_register_username_member(text,text,text,text,text,text,text,text)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.api_register_and_bind_wechat_member(uuid,text,text,text,text,text,text,text,text)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.api_register_and_bind_wechat_member(uuid,text,text,text,text,text,text,text,text)',
       'execute'
     )
     or to_regprocedure(
       'public.api_register_storefront_member(uuid,text,text,text,jsonb,text,text,text)'
     ) is not null
     or not has_function_privilege(
       'service_role',
       'public.api_register_storefront_member(uuid,text,text,text,jsonb,text,text,text,text,text,text)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.api_register_storefront_member(uuid,text,text,text,jsonb,text,text,text,text,text,text)',
       'execute'
     )
  then raise exception 'CONTRACT_REGISTRATION_TERMS_FUNCTION_ACL_INVALID'; end if;

  select count(*) into attempts_before
  from public.username_registration_attempts
  where ip_hash='terms-contract-ip-hash';
  update public.registration_terms_policy set
    terms_version='2026-08-20',updated_at=now(),updated_by=current_user
  where singleton;
  if public.api_registration_terms()->>'version'<>'2026-08-20' then
    raise exception 'CONTRACT_REGISTRATION_TERMS_OWNER_UPDATE_NOT_VISIBLE';
  end if;
  result:=public.api_register_username_member(
    'terms.contract',repeat('x',40),'条款合同用户','invalid-invite-hash',
    'terms-contract-ip-hash','terms-contract-request','contract-test','2026-08-13'
  );
  if result->>'status'<>'terms_version_mismatch'
     or (select count(*) from public.username_registration_attempts
         where ip_hash='terms-contract-ip-hash')<>attempts_before
  then raise exception 'CONTRACT_REGISTRATION_TERMS_DRIFT_NOT_CLOSED'; end if;
  result:=public.api_register_and_bind_wechat_member(
    '11111111-1111-4111-8111-111111111111'::uuid,
    'terms.wechat',repeat('x',40),'微信条款合同用户','invalid-invite-hash',
    'terms-wechat-ip-hash','terms-wechat-request','contract-test','2026-08-13'
  );
  if result->>'status'<>'terms_version_mismatch'
     or exists(
       select 1 from public.username_registration_attempts
       where ip_hash='terms-wechat-ip-hash'
     )
  then raise exception 'CONTRACT_WECHAT_REGISTRATION_TERMS_DRIFT_NOT_CLOSED'; end if;
  result:=public.api_register_storefront_member(
    '22222222-2222-4222-8222-222222222222'::uuid,
    'terms.phone',repeat('x',40),'138****8000','{}'::jsonb,
    repeat('x',40),'手机条款合同用户','invalid-invite-hash',
    'terms-phone-request','contract-test','2026-08-13'
  );
  if result->>'status'<>'terms_version_mismatch' then
    raise exception 'CONTRACT_PHONE_REGISTRATION_TERMS_DRIFT_NOT_CLOSED';
  end if;
  result:=public.api_register_username_member(
    'terms.current',repeat('x',40),'当前条款用户','invalid-invite-hash',
    'terms-current-ip-hash','terms-current-request','contract-test','2026-08-20'
  );
  if result->>'status'<>'invalid_invite' then
    raise exception 'CONTRACT_REGISTRATION_TERMS_CURRENT_VERSION_REJECTED';
  end if;

  delete from public.registration_terms_policy where singleton;
  if public.api_registration_terms() is not null then
    raise exception 'CONTRACT_REGISTRATION_TERMS_MISSING_PROJECTION_NOT_NULL';
  end if;
  result:=public.api_register_username_member(
    'terms.contract',repeat('x',40),'条款合同用户','invalid-invite-hash',
    'terms-contract-ip-hash','terms-contract-request','contract-test','2026-08-20'
  );
  if result->>'status'<>'terms_policy_unavailable' then
    raise exception 'CONTRACT_REGISTRATION_TERMS_MISSING_POLICY_NOT_CLOSED';
  end if;
  result:=public.api_register_storefront_member(
    '33333333-3333-4333-8333-333333333333'::uuid,
    'terms.phone',repeat('x',40),'138****8000','{}'::jsonb,
    repeat('x',40),'手机条款合同用户','invalid-invite-hash',
    'terms-phone-request','contract-test','2026-08-20'
  );
  if result->>'status'<>'terms_policy_unavailable' then
    raise exception 'CONTRACT_PHONE_REGISTRATION_TERMS_MISSING_NOT_CLOSED';
  end if;
end;
$$;

rollback;
