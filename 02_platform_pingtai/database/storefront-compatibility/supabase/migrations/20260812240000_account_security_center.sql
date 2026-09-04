-- Account and membership security center: server-side revocable sessions,
-- password lifecycle, phone replacement and real credential step-up.

alter table public.member_credentials
  add column if not exists credential_version integer not null default 1
  check (credential_version > 0);

alter table public.phone_verification_challenges
  drop constraint if exists phone_verification_challenges_purpose_check;
alter table public.phone_verification_challenges
  add constraint phone_verification_challenges_purpose_check
  check (purpose in ('registration', 'password_reset', 'phone_change'));

create table if not exists public.auth_sessions (
  id uuid primary key,
  member_id text not null references public.members(id) on delete restrict,
  membership_id text not null references public.memberships(id) on delete restrict,
  target text not null check (target in ('storefront', 'admin')),
  credential_version integer,
  ip_hash text not null,
  user_agent text not null default '',
  device_label text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text,
  check (expires_at > created_at),
  check ((revoked_at is null and revoked_reason is null) or revoked_at is not null)
);

create index if not exists auth_sessions_member_active
on public.auth_sessions (member_id, revoked_at, expires_at desc);

create unique index if not exists member_login_aliases_one_phone_per_member
on public.member_login_aliases (member_id) where provider='local_phone';

create or replace function public.api_create_auth_session(
  p_session_id uuid, p_member_id text, p_membership_id text, p_target text,
  p_ip_hash text, p_user_agent text, p_device_label text, p_expires_at timestamptz
) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare version integer;
begin
  if p_expires_at <= now() or p_expires_at > now() + interval '8 hours 1 minute' then return false; end if;
  if not exists (
    select 1 from public.memberships ms join public.members m on m.id=ms.member_id
    where ms.id=p_membership_id and ms.member_id=p_member_id and ms.target=p_target
      and ms.status='active' and m.status='active'
  ) then return false; end if;
  select credential_version into version from public.member_credentials where member_id=p_member_id;
  insert into public.auth_sessions (
    id,member_id,membership_id,target,credential_version,ip_hash,user_agent,device_label,expires_at
  ) values (
    p_session_id,p_member_id,p_membership_id,p_target,version,p_ip_hash,
    left(coalesce(p_user_agent,''),300),left(p_device_label,100),p_expires_at
  );
  return true;
end;
$$;

create or replace function public.api_resolve_session_membership_context(
  p_session_id uuid, p_member_id text, p_membership_id text, p_target text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare session_row public.auth_sessions%rowtype;
declare current_version integer;
begin
  select * into session_row from public.auth_sessions
  where id=p_session_id and member_id=p_member_id and membership_id=p_membership_id
    and target=p_target and revoked_at is null and expires_at > now();
  if not found then return null; end if;
  select credential_version into current_version from public.member_credentials where member_id=p_member_id;
  if current_version is not null and session_row.credential_version is distinct from current_version then return null; end if;
  if session_row.last_seen_at < now()-interval '5 minutes' then
    update public.auth_sessions set last_seen_at=now() where id=p_session_id;
  end if;
  return public.api_resolve_membership_context(p_member_id,p_membership_id,p_target);
end;
$$;

create or replace function public.api_revoke_auth_session(
  p_actor_member_id text, p_session_id uuid, p_reason text
) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.auth_sessions set revoked_at=coalesce(revoked_at,now()),
    revoked_reason=coalesce(revoked_reason,left(p_reason,160))
  where id=p_session_id and member_id=p_actor_member_id;
  return found;
end;
$$;

create or replace function public.api_revoke_other_auth_sessions(
  p_actor_member_id text, p_current_session_id uuid, p_reason text
) returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare affected integer;
begin
  update public.auth_sessions set revoked_at=now(),revoked_reason=left(p_reason,160)
  where member_id=p_actor_member_id and id<>p_current_session_id
    and revoked_at is null and expires_at>now();
  get diagnostics affected=row_count;
  return affected;
end;
$$;

create or replace function public.api_account_security_center(
  p_member_id text, p_current_session_id uuid
) returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'hasLocalCredential',c.member_id is not null,
    'phoneMasked',u.mobile_masked,
    'passwordChangedAt',c.password_changed_at,
    'sessions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',s.id,'target',s.target,'deviceLabel',s.device_label,
      'createdAt',s.created_at,'lastSeenAt',s.last_seen_at,'expiresAt',s.expires_at,
      'current',s.id=p_current_session_id
    ) order by (s.id=p_current_session_id) desc,s.last_seen_at desc)
    from public.auth_sessions s where s.member_id=m.id and s.revoked_at is null and s.expires_at>now()),'[]'::jsonb)
  )
  from public.members m join public.users u on u.id=m.user_id
  left join public.member_credentials c on c.member_id=m.id
  where m.id=p_member_id;
$$;

create or replace function public.api_member_credential(p_member_id text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object('passwordHash',password_hash,'credentialVersion',credential_version)
  from public.member_credentials where member_id=p_member_id;
$$;

-- One credential may be reached through a private phone lookup alias or a
-- development-only named test alias. The application decides which provider
-- is legal for the current environment; production never enables `test`.
create or replace function public.api_local_login_candidate(
  p_provider text,p_subject text,p_target text default null
) returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'memberId',m.id,'membershipId',ms.id,'target',ms.target,
    'passwordHash',c.password_hash,'mustResetPassword',c.must_reset_password
  )
  from public.member_login_aliases a
  join public.members m on m.id=a.member_id and m.status='active'
  join public.member_credentials c on c.member_id=m.id
  join public.memberships ms on ms.member_id=m.id and ms.status='active'
    and (p_target is null or ms.target=p_target)
    and (ms.expires_at is null or ms.expires_at>now())
  where a.provider=p_provider and a.subject=p_subject
  order by case when ms.target='storefront' then 0 else 1 end,ms.created_at
  limit 1;
$$;

create or replace function public.api_create_security_challenge(
  p_challenge_id uuid,p_phone_subject text,p_phone_masked text,p_purpose text,
  p_code_hash text,p_ip_hash text,p_expires_at timestamptz
) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_purpose not in ('password_reset','phone_change') then return false; end if;
  if p_expires_at<=now() or p_expires_at>now()+interval '10 minutes' then return false; end if;
  if (select count(*) from public.phone_verification_challenges where phone_subject=p_phone_subject and created_at>now()-interval '15 minutes')>=5 then return false; end if;
  if (select count(*) from public.phone_verification_challenges where ip_hash=p_ip_hash and created_at>now()-interval '1 hour')>=20 then return false; end if;
  insert into public.phone_verification_challenges(id,phone_subject,phone_masked,purpose,code_hash,ip_hash,expires_at)
  values(p_challenge_id,p_phone_subject,p_phone_masked,p_purpose,p_code_hash,p_ip_hash,p_expires_at);
  return true;
end;
$$;

create or replace function public.api_change_local_password(
  p_member_id text,p_current_session_id uuid,p_password_hash text
) returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare next_version integer;
begin
  update public.member_credentials set password_hash=p_password_hash,
    password_changed_at=now(),must_reset_password=false,
    credential_version=credential_version+1,updated_at=now()
  where member_id=p_member_id returning credential_version into next_version;
  if not found then return false; end if;
  update public.auth_sessions set revoked_at=now(),revoked_reason='password_changed'
  where member_id=p_member_id and id<>p_current_session_id and revoked_at is null;
  update public.auth_sessions set credential_version=next_version where id=p_current_session_id and member_id=p_member_id;
  return true;
end;
$$;

create or replace function public.api_reset_local_password(
  p_challenge_id uuid,p_phone_subject text,p_code_hash text,p_password_hash text
) returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare challenge public.phone_verification_challenges%rowtype;
declare target_member text;
begin
  select * into challenge from public.phone_verification_challenges
  where id=p_challenge_id and phone_subject=p_phone_subject and purpose='password_reset'
    and consumed_at is null and expires_at>now() and attempts<5 for update;
  if not found then return 'invalid_code'; end if;
  if challenge.code_hash<>p_code_hash then
    update public.phone_verification_challenges set attempts=least(attempts+1,5) where id=p_challenge_id;
    return 'invalid_code';
  end if;
  select member_id into target_member from public.member_login_aliases
  where provider='local_phone' and subject=p_phone_subject;
  if target_member is null then return 'invalid_code'; end if;
  update public.member_credentials set password_hash=p_password_hash,password_changed_at=now(),
    must_reset_password=false,credential_version=credential_version+1,updated_at=now()
  where member_id=target_member;
  update public.auth_sessions set revoked_at=now(),revoked_reason='password_reset'
  where member_id=target_member and revoked_at is null;
  update public.phone_verification_challenges set consumed_at=now() where id=p_challenge_id;
  return 'changed';
end;
$$;

create or replace function public.api_change_local_phone(
  p_member_id text,p_challenge_id uuid,p_phone_subject text,p_code_hash text,
  p_phone_masked text,p_phone_cipher jsonb,p_current_session_id uuid
) returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare challenge public.phone_verification_challenges%rowtype;
declare old_subject text;
begin
  select * into challenge from public.phone_verification_challenges
  where id=p_challenge_id and phone_subject=p_phone_subject and purpose='phone_change'
    and consumed_at is null and expires_at>now() and attempts<5 for update;
  if not found or challenge.code_hash<>p_code_hash then
    if found then update public.phone_verification_challenges set attempts=least(attempts+1,5) where id=p_challenge_id; end if;
    return 'invalid_code';
  end if;
  if exists(select 1 from public.member_login_aliases where provider='local_phone' and subject=p_phone_subject and member_id<>p_member_id) then return 'phone_exists'; end if;
  if not exists(select 1 from public.member_credentials where member_id=p_member_id) then return 'credential_missing'; end if;
  select subject into old_subject from public.member_login_aliases where provider='local_phone' and member_id=p_member_id;
  if old_subject is null then
    insert into public.member_login_aliases(provider,subject,member_id) values('local_phone',p_phone_subject,p_member_id);
  else
    update public.member_login_aliases set subject=p_phone_subject where provider='local_phone' and member_id=p_member_id;
  end if;
  update public.member_credentials set phone_cipher=p_phone_cipher,updated_at=now() where member_id=p_member_id;
  update public.users set mobile_masked=p_phone_masked,updated_at=now()
  where id=(select user_id from public.members where id=p_member_id);
  update public.auth_sessions set revoked_at=now(),revoked_reason='phone_changed'
  where member_id=p_member_id and id<>p_current_session_id and revoked_at is null;
  update public.phone_verification_challenges set consumed_at=now() where id=p_challenge_id;
  return 'changed';
exception when unique_violation then return 'phone_exists';
end;
$$;

-- The public acceptance roster gets real, mutable password hashes. These are
-- test identities only; named aliases are still disabled outside test/test.
insert into public.member_credentials(member_id,password_hash,phone_cipher)
values
  ('member-test-owner','pbkdf2-sha256$310000$vlnO7l4ZazwXxYMqdEKPPQ==$ToojPbZT2Iz9j/2KrgcF44L54Gy6k6h3tl44jFyv8B0=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-buyer-001','pbkdf2-sha256$310000$YSIFg/ui5E3Fr0inOR58iw==$nR9fXtTIkoSC3z5EVwOPN3JqjfxHeFCGgBV0S1suyAE=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-buyer-002','pbkdf2-sha256$310000$RFo8Etd9RZbVdJGArutOhA==$gEIlLY1ltvcT6i5wwb2rTpYeti4E0LmjvJ+fc3ctpHY=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-buyer-003','pbkdf2-sha256$310000$euWtwDrtt05vTJaYeg3Zjw==$QHRDsmdk3s0zHyyt+78ZFITqflztZuu9qg5VbQlQTMc=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-buyer-004','pbkdf2-sha256$310000$Oh741GqKZmnthFYhi1+G2w==$9wxM07M0+Db1sS99OoRwfHc3R1l1sehgZHCIeIdAxjc=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-buyer-005','pbkdf2-sha256$310000$YN1Q1p4q4kFtRCZCfL5k7g==$Nt4A2ZHNbvpYzxqrSRazv4W0jWR9BZieh2OMNy0Kdt4=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-seller-001','pbkdf2-sha256$310000$oXeF1JxU6a8HnoEXgRBuyQ==$EweYoxmlLb5NW+nOtvpBHgvEuqmrUbV25HigFaYLGHI=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-seller-002','pbkdf2-sha256$310000$ziq/2k0XY8QF67dNRjDz5w==$cJBX3rqdxWis37kHBFGp/k6Af0mtMb5N3Moj8j+f88Y=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-seller-003','pbkdf2-sha256$310000$02fbiUiWxtUMigypxCAoWA==$+0rbl05qHSdVXB7Oqc4vLAT3zIV2DumSCfemsfD6hjw=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-seller-004','pbkdf2-sha256$310000$8vC8cSfgVApd4BhM5kD6zw==$ucvayCE2GzitegtV560Fwpqmj27YIS6AL2AegssO0Gs=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-seller-005','pbkdf2-sha256$310000$wkim6XLaj9m7RiA6fibqxg==$a2e8+VSAz08zMbKOTrn5QeTX3JPtkKnD9yRYNwmQHCk=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-ops-001','pbkdf2-sha256$310000$Hz2Hl8Zf0YH4KDyRexHrDQ==$OVV3tTGE3YxcAO2xiSKmmX5vduOi+oAOIh/GooQFoQg=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-ops-002','pbkdf2-sha256$310000$6ry+twZP16ZoaxEK9MY2nw==$d4E3uGteezKYRU8FzJFOfuLxVjnm74A76oVvdUp34UY=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-ops-003','pbkdf2-sha256$310000$DMRi0mPqeD4vUTYlG7wscQ==$X5T83WdMTKElsYTVNcdWBuOnOhfEcblerUt3XIoNTbA=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-ops-004','pbkdf2-sha256$310000$uQ8aJvebtKm/hQnTKdtH5A==$ZdkRt8rLVj8WPk7S/jGvrCS0AUPEPqpXdIO1TNg05xo=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-ops-005','pbkdf2-sha256$310000$Wlji9juqVWsm3Gdhx6WVfA==$MzHOOetrZSRVLJ9lVMe485eTEwvmeChMhobax8x4z20=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-cs-001','pbkdf2-sha256$310000$YA1iFa8LU8gtt8xLHYLj+A==$5NNXCz84AgDd7oUYg8auvsliuqCAUB9fHipfpgCuUV4=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-cs-002','pbkdf2-sha256$310000$9Z+db9m9O1TXlludMsFdHQ==$LUqstqpOEQbv+i4YPm3LaG/y45QCqpza4p2ZqQyggIY=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-cs-003','pbkdf2-sha256$310000$QXCln7J5qJQCynhdHZhIsQ==$rLrwqFf2ngDpzqcGmVsEUysE/EBTT2M6hkwTGtLKTYM=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-cs-004','pbkdf2-sha256$310000$rPIEsTAXSccZRkKxNyHZzw==$Xj4qFzU5yzgzKfkeN3PwIzEv/C+LXPWYP6WQWwk1g0s=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-cs-005','pbkdf2-sha256$310000$1WznDM6cp9yu6BKNur2NEQ==$LC2FiVrnS/MqLdvPN/8OXYjMvFP8I8WdoAGTrsYo2RQ=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-admin-001','pbkdf2-sha256$310000$hGWNhzfBTFStMQTL1f+qtA==$Rw464JZswMnugUPbWAgcUO+ppHdnAUW4hUrZpeCX+LE=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-admin-002','pbkdf2-sha256$310000$oU3nnDI53MtTF1wS4Chr5A==$U4+/B/p7BXKJ3apgaz81dkn1sNXmmmXYS/N9Poak6j0=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-admin-003','pbkdf2-sha256$310000$tZlVkS3dW6iGWSNHzQKVug==$xIH0jfxTls1F+5+4jJL14wmU3WpF4a9fLx4NB9rpMr8=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-admin-004','pbkdf2-sha256$310000$gpV5xS6hagPfl6fny04unQ==$gYnRNEwrvTWayZ2NI4T11JoAtZCrOgU2P/f9+BeZ5aA=','{"v":1,"kind":"unbound_test_account"}'::jsonb),
  ('member-test-admin-005','pbkdf2-sha256$310000$gla+jLKXBNSe8mzRA9sIcA==$Y2th1asQoieZSQga/pBZ0dugqKBl324RN8Rao/iX9j4=','{"v":1,"kind":"unbound_test_account"}'::jsonb)
on conflict(member_id) do nothing;

revoke all on table public.auth_sessions from public,anon,authenticated;
alter table public.auth_sessions enable row level security;

do $$ declare signature text; begin
  foreach signature in array array[
    'api_create_auth_session(uuid,text,text,text,text,text,text,timestamptz)',
    'api_resolve_session_membership_context(uuid,text,text,text)',
    'api_revoke_auth_session(text,uuid,text)','api_revoke_other_auth_sessions(text,uuid,text)',
    'api_account_security_center(text,uuid)','api_member_credential(text)',
    'api_local_login_candidate(text,text,text)',
    'api_create_security_challenge(uuid,text,text,text,text,text,timestamptz)',
    'api_change_local_password(text,uuid,text)','api_reset_local_password(uuid,text,text,text)',
    'api_change_local_phone(text,uuid,text,text,text,jsonb,uuid)'
  ] loop execute 'revoke all on function public.'||signature||' from public,anon,authenticated'; execute 'grant execute on function public.'||signature||' to service_role'; end loop;
end $$;
