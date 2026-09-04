begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904017000') then raise exception 'MEMBER_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904018000')
    or exists(select 1 from information_schema.columns where table_schema='member' and table_name='address' and column_name='is_default')
    or to_regclass('member.preference') is not null
    or exists(select 1 from runtime.event where type in('member.address.changed','member.favorite.changed')) then raise exception 'MEMBER_ALREADY_APPLIED'; end if;
end
$precondition$;

create table member.preference(
  member_id text primary key references member.profile(id) on delete restrict,
  locale text not null check(locale~'^[a-z]{2}(-[A-Z]{2})?$'),
  timezone text not null check(length(timezone) between 3 and 64),
  marketing_allowed boolean not null,
  version bigint not null check(version>0),
  updated_at timestamptz not null
);
insert into member.preference(member_id,locale,timezone,marketing_allowed,version,updated_at)
select id,'zh-CN','Asia/Shanghai',false,1,updated_at from member.profile;

create function member.initialize_preference()
returns trigger language plpgsql security definer set search_path=member,pg_temp set row_security=off as $function$
begin
  insert into member.preference(member_id,locale,timezone,marketing_allowed,version,updated_at)
  values(new.id,'zh-CN','Asia/Shanghai',false,1,clock_timestamp());
  return new;
end
$function$;
create trigger memberpreference after insert on member.profile for each row execute function member.initialize_preference();

alter table member.preference enable row level security;
alter table member.preference force row level security;
create policy preferenceapp on member.preference for all to shopapp using(access.scope_allowed(member_id)) with check(access.scope_allowed(member_id));
create policy preferencejob on member.preference for all to shopjob using(true) with check(true);
revoke all on member.preference from public;
revoke all on function member.initialize_preference() from public;
grant select,insert,update on member.preference to shopapp,shopjob;

alter table member.address add column is_default boolean not null default false;
alter table member.address add column created_at timestamptz not null default clock_timestamp();
alter table member.address add column updated_at timestamptz not null default clock_timestamp();
update member.address set created_at=clock_timestamp(),updated_at=clock_timestamp();

with ranked as (
  select id,row_number() over(partition by member_id order by id) position
  from member.address where status='active'
)
update member.address address set is_default=true from ranked where ranked.id=address.id and ranked.position=1;

create unique index member_address_one_default on member.address(member_id) where status='active' and is_default;

create function member.assert_default_address()
returns trigger language plpgsql security definer set search_path=member,pg_temp set row_security=off as $function$
declare
  subject text;
  active_count bigint;
  default_count bigint;
begin
  subject=case when tg_op='DELETE' then old.member_id else new.member_id end;
  select count(*),count(*) filter(where is_default) into active_count,default_count
  from member.address where member_id=subject and status='active';
  if active_count>0 and default_count<>1 then raise exception 'MEMBER_DEFAULT_ADDRESS_REQUIRED'; end if;
  if tg_op='UPDATE' and old.member_id<>new.member_id then
    select count(*),count(*) filter(where is_default) into active_count,default_count
    from member.address where member_id=old.member_id and status='active';
    if active_count>0 and default_count<>1 then raise exception 'MEMBER_DEFAULT_ADDRESS_REQUIRED'; end if;
  end if;
  return null;
end
$function$;
create constraint trigger memberdefaultaddress after insert or update or delete on member.address
deferrable initially deferred for each row execute function member.assert_default_address();

alter table member.favorite add column status text not null default 'active' check(status in('active','removed'));
alter table member.favorite add column updated_at timestamptz not null default clock_timestamp();
alter table member.favorite add column version bigint not null default 1 check(version>0);
update member.favorite set updated_at=created_at,status='active',version=1;

alter table member.address force row level security;
alter table member.favorite force row level security;
revoke delete on member.favorite from shopapp,shopjob;
grant select,insert,update on member.favorite to shopapp,shopjob;
do $roles$
begin
  if exists(select 1 from pg_roles where rolname='zhudatuanwebapi') then
    execute 'revoke delete on member.favorite from zhudatuanwebapi';
    execute 'grant select,insert,update on member.favorite to zhudatuanwebapi';
  end if;
  if exists(select 1 from pg_roles where rolname='zhudatuanpurchaseapi') then
    execute 'revoke delete on member.favorite from zhudatuanpurchaseapi';
    execute 'grant select,insert,update on member.favorite to zhudatuanpurchaseapi';
  end if;
end
$roles$;

create or replace function member.profile_summary(p_member text,p_scope text)
returns table(id text,display_name text,employee_no text,mobile_masked text,status text,version bigint)
language sql stable security definer
set search_path=member,access,organization,pg_temp
set row_security=off
as $function$
  select profile.id,profile.display_name,membership.employee_no,profile.mobile_masked,profile.status,profile.version
  from member.profile profile
  left join lateral (
    select candidate.id,candidate.employee_no from access.membership candidate
    where candidate.member_id=profile.id and candidate.status='active'
      and exists(select 1 from organization.unitclosure related
        where (related.ancestor_id=p_scope and related.descendant_id=candidate.organization_id)
          or (related.ancestor_id=candidate.organization_id and related.descendant_id=p_scope))
    order by (candidate.organization_id=p_scope) desc,candidate.id limit 1
  ) membership on true
  where profile.id=p_member and profile.status='active'
    and (membership.id is not null or p_scope=profile.id or p_scope='self:'||profile.principal_id)
$function$;
revoke all on function member.profile_summary(text,text),member.assert_default_address() from public;
grant execute on function member.profile_summary(text,text) to shopapp;

update capability.capability set version=2
where id in('member.profile.read','member.addresses.read','member.addresses.manage','member.favorites.read','member.favorites.put');

insert into runtime.event(type,version,owner,schema_ref) values
  ('member.address.changed',1,'member','contract://events/member.address.changed/v1'),
  ('member.favorite.changed',1,'member','contract://events/member.favorite.changed/v1');

update runtime.contractcatalog
set checksum='43b418c50edc1edcfbf5daac6628555bc2cf2dde6e069b83febf37fa0639c5b5',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260904018000',
  (select count(distinct member_id) from member.address where status='active'),
  (select count(*) from member.address where status='active' and is_default),0,0,
  'select member_id,count(*) active_count,count(*) filter(where is_default) default_count from member.address where status=''active'' group by member_id order by member_id;',
  'select member_id,count(*) from member.address where status=''active'' and is_default group by member_id having count(*)<>1;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904018000','43b418c50edc1edcfbf5daac6628555bc2cf2dde6e069b83febf37fa0639c5b5');

do $assert$
begin
  if exists(
    select 1 from member.address where status='active' group by member_id
    having count(*) filter(where is_default)<>1
  ) then raise exception 'MEMBER_DEFAULT_ADDRESS_INVALID'; end if;
  if exists(select 1 from member.favorite where status<>'active' or version<>1 or updated_at<>created_at) then raise exception 'MEMBER_FAVORITE_BACKFILL_INVALID'; end if;
  if (select count(*) from member.profile)<>(select count(*) from member.preference) then raise exception 'MEMBER_PREFERENCE_BACKFILL_INVALID'; end if;
  if exists(select 1 from capability.capability where id in('member.profile.read','member.addresses.read','member.addresses.manage','member.favorites.read','member.favorites.put') and version<>2) then raise exception 'MEMBER_CAPABILITY_VERSION_INVALID'; end if;
  if (select count(*) from runtime.operation)<>304 or (select count(*) from capability.operation)<>304
    or (select count(*) from runtime.event)<>121 then raise exception 'MEMBER_CONTRACT_CATALOG_INVALID'; end if;
  if not exists(select 1 from runtime.contractcatalog where artifact='commerce' and version='5.0.0' and status='active'
    and checksum='43b418c50edc1edcfbf5daac6628555bc2cf2dde6e069b83febf37fa0639c5b5'
    and operation_count=304 and event_count=121) then raise exception 'MEMBER_CONTRACT_IDENTITY_INVALID'; end if;
end
$assert$;

commit;
