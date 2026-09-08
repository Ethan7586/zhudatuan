begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904015000') then raise exception 'IDENTITY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904016000') or to_regclass('identity.refreshtoken') is not null then raise exception 'IDENTITY_ALREADY_APPLIED'; end if;
end
$precondition$;

create table identity.refreshtoken(
  id text primary key check(id~'^refreshtoken:'),
  family_id text not null check(family_id~'^tokenfamily:'),
  session_id text not null references identity.session(id) on delete cascade,
  parent_id text references identity.refreshtoken(id),
  token_hash char(64) not null unique check(token_hash~'^[0-9a-f]{64}$'),
  sequence bigint not null check(sequence>=0),
  issued_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  unique(family_id,sequence),
  unique(id,family_id,session_id),
  check((sequence=0 and parent_id is null) or (sequence>0 and parent_id is not null)),
  check(used_at is null or used_at>=issued_at),
  check(revoked_at is null or revoked_at>=issued_at)
);

insert into identity.refreshtoken(id,family_id,session_id,parent_id,token_hash,sequence,issued_at,revoked_at)
select 'refreshtoken:'||encode(public.digest(session.id||':baseline','sha256'),'hex'),
  'tokenfamily:'||encode(public.digest(session.id||':family','sha256'),'hex'),session.id,null,session.token_hash,0,
  session.created_at,case when session.revoked_at is null then null else greatest(session.revoked_at,session.created_at) end
from identity.session session;

create index identity_refreshtoken_current on identity.refreshtoken(session_id,sequence desc)
  include(token_hash,family_id) where used_at is null and revoked_at is null;
create index identity_refreshtoken_cleanup on identity.refreshtoken(coalesce(revoked_at,used_at,issued_at),id);

create function identity.revoke_session_token_family()
returns trigger language plpgsql security definer set search_path=identity,pg_temp set row_security=off as $function$
begin
  if old.revoked_at is null and new.revoked_at is not null then
    update identity.refreshtoken set revoked_at=coalesce(revoked_at,new.revoked_at)
    where session_id=new.id and revoked_at is null;
  end if;
  return new;
end
$function$;
create trigger sessiontokenfamilyrevoke after update of revoked_at on identity.session
for each row execute function identity.revoke_session_token_family();

create or replace function access.assert_role_separation()
returns trigger language plpgsql security definer set search_path=access,pg_temp set row_security=on as $function$
declare affected text:=coalesce(new.role_id,old.role_id);
begin
  if exists(select 1 from access.role where id=affected and kind='owner') then return null; end if;
  if exists(
    select 1 from access.separationrule rule
    where rule.state='active'
      and exists(select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
        where mapping.role_id=affected and mapping.effect='allow' and permission.code=rule.left_permission)
      and exists(select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
        where mapping.role_id=affected and mapping.effect='allow' and permission.code=rule.right_permission)
  ) then raise exception 'ACCESS_SEPARATION_REQUIRED'; end if;
  return null;
end
$function$;

insert into access.permission(id,code,risk,status,name_zh)
values('permission:62a354df9138535ba0651fd6','identity.registration.reset','critical','active','重置成员注册');
insert into access.rolepermission(role_id,permission_id,effect)
select role.id,permission.id,'allow' from access.role role cross join access.permission permission
where role.kind='owner' and role.status='active' and permission.code='identity.registration.reset'
on conflict(role_id,permission_id) do update set effect='allow';
update access.role role set version=version+1 where role.kind='owner' and role.status='active';
update access.membership membership set access_version=access_version+1
where membership.status='active' and exists(
  select 1 from access.membershiprole assignment join access.role role on role.id=assignment.role_id
  where assignment.membership_id=membership.id and role.kind='owner' and role.status='active'
    and assignment.effective_at<=clock_timestamp() and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
);

alter table identity.refreshtoken enable row level security;
alter table identity.refreshtoken force row level security;
create policy refreshtokenapp on identity.refreshtoken for all to shopapp using(true) with check(true);
create policy refreshtokenjob on identity.refreshtoken for all to shopjob using(true) with check(true);
revoke all on table identity.refreshtoken from public;
revoke all on function identity.revoke_session_token_family() from public;
grant select,insert,update on identity.refreshtoken to shopapp,shopjob;

select runtime.record_migration_evidence(
  '20260904016000',
  (select count(*) from identity.refreshtoken),
  (select count(*) from identity.session),0,0,
  'select family_id,sequence,used_at,revoked_at from identity.refreshtoken order by family_id,sequence;',
  'select family_id,count(*) from identity.refreshtoken where used_at is null and revoked_at is null group by family_id having count(*)<>1;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904016000',encode(public.digest('20260904016000_prepare_identity','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from identity.refreshtoken)<>(select count(*) from identity.session) then raise exception 'IDENTITY_REFRESH_BACKFILL_MISMATCH'; end if;
  if exists(select 1 from identity.refreshtoken group by family_id having count(*) filter(where used_at is null and revoked_at is null)>1) then raise exception 'IDENTITY_REFRESH_FAMILY_FORK'; end if;
  if not exists(select 1 from access.rolepermission mapping join access.role role on role.id=mapping.role_id
    join access.permission permission on permission.id=mapping.permission_id
    where role.kind='owner' and mapping.effect='allow' and permission.code='identity.registration.reset') then raise exception 'IDENTITY_REGISTRATION_RESET_PERMISSION_MISSING'; end if;
end
$assert$;

commit;
