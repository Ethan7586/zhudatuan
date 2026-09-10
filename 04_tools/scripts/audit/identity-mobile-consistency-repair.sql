begin;

set local lock_timeout = '3s';
set local statement_timeout = '15s';

create temporary table identity_mobile_repair_target on commit drop as
select account.id, account.realm_id, account.mobile_token
from identity.account account
where account.id = any(array[
  'account:realm:l0:b979464026dc95522593c8825982aff7',
  'account:realm:l0:d96c7ac690354b9fb845883fc74f314a',
  'account:realm:l1:b979464026dc95522593c8825982aff7',
  'account:realm:l1:fc3e61c4c1eba5a6b37cf29efc7a9ea0'
]);

do $$
declare
  target_count integer;
  mismatch_count integer;
  collision_count integer;
begin
  select count(*) into target_count from identity_mobile_repair_target;
  if target_count <> 4 then
    raise exception 'IDENTITY_MOBILE_REPAIR_TARGET_COUNT_INVALID';
  end if;

  select count(*) into mismatch_count
  from identity_mobile_repair_target target
  join identity.credential credential
    on credential.account_id = target.id
    and credential.realm_id = target.realm_id
    and credential.provider = 'password'
    and credential.status = 'active'
  where target.mobile_token is not null
    and credential.subject_hash is distinct from target.mobile_token;
  if mismatch_count <> 4 then
    raise exception 'IDENTITY_MOBILE_REPAIR_PRECONDITION_CHANGED';
  end if;

  select count(*) into collision_count
  from identity_mobile_repair_target target
  join identity.credential credential
    on credential.realm_id = target.realm_id
    and credential.subject_hash = target.mobile_token
    and credential.status = 'active'
    and credential.account_id <> target.id;
  if collision_count <> 0 then
    raise exception 'IDENTITY_MOBILE_REPAIR_SUBJECT_COLLISION';
  end if;
end $$;

update identity.credential credential
set subject_hash = target.mobile_token,
    rotated_at = clock_timestamp()
from identity_mobile_repair_target target
where credential.account_id = target.id
  and credential.realm_id = target.realm_id
  and credential.provider = 'password'
  and credential.status = 'active'
  and credential.subject_hash is distinct from target.mobile_token;

update identity.account account
set credential_version = credential_version + 1,
    version = version + 1,
    updated_at = clock_timestamp()
from identity_mobile_repair_target target
where account.id = target.id
  and account.realm_id = target.realm_id;

update identity.session session
set revoked_at = clock_timestamp(),
    revoked_reason = 'identity_mobile_consistency_repair'
from identity_mobile_repair_target target
where session.account_id = target.id
  and session.realm_id = target.realm_id
  and session.revoked_at is null;

commit;
