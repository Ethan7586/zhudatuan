begin transaction read only;

with password_credential as (
  select account_id, realm_id, count(*) as active_count, min(subject_hash) as subject_hash
  from identity.credential
  where provider = 'password' and status = 'active'
  group by account_id, realm_id
), profile_projection as (
  select principal_id, count(*) as profile_count,
    min(mobile_token) as mobile_token, min(mobile_masked) as mobile_masked
  from member.profile
  where status = 'active'
  group by principal_id
), session_check as (
  select session.account_id, max(session.last_seen_at) as last_session,
    bool_or(
      session.principal_id is distinct from account.legacy_principal_id
      or session.realm_id is distinct from account.realm_id
      or (session.membership_id is not null and not exists (
        select 1 from access.membership membership
        where membership.id = session.membership_id
          and membership.account_id = session.account_id
          and membership.realm_id = session.realm_id
      ))
    ) as session_mismatch
  from identity.session session
  join identity.account account on account.id = session.account_id
  group by session.account_id
), audit as (
  select account.id, account.realm_id, account.mobile_masked,
    account.created_at, account.updated_at,
    coalesce(credential.active_count, 0) as credential_count,
    case when credential.active_count = 1
      then credential.subject_hash is distinct from account.mobile_token
      else false end as credential_mismatch,
    coalesce(profile.profile_count, 0) as profile_count,
    case when profile.profile_count = 1
      then profile.mobile_token is distinct from account.mobile_token
        or profile.mobile_masked is distinct from account.mobile_masked
      else false end as profile_mismatch,
    coalesce(session.session_mismatch, false) as session_mismatch,
    session.last_session
  from identity.account account
  left join password_credential credential
    on credential.account_id = account.id and credential.realm_id = account.realm_id
  left join profile_projection profile
    on profile.principal_id = account.legacy_principal_id
  left join session_check session on session.account_id = account.id
  where account.status = 'active'
)
select id as account_id, realm_id, mobile_masked, created_at, last_session,
  concat_ws(',',
    case when credential_mismatch then 'credential' end,
    case when profile_mismatch then 'profile' end,
    case when session_mismatch then 'session' end,
    case when credential_count > 1 then 'multiple_credentials' end,
    case when profile_count > 1 then 'multiple_profiles' end
  ) as inconsistent_fields
from audit
where credential_mismatch or profile_mismatch or session_mismatch
  or credential_count > 1 or profile_count > 1
order by realm_id, id;

rollback;
