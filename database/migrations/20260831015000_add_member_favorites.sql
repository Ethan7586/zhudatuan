begin;

create table member.favorite(
  member_id text not null references member.profile(id) on delete cascade,
  listing_id text not null,
  created_at timestamptz not null,
  primary key(member_id,listing_id),
  check(length(listing_id) between 3 and 255)
);

create index member_favorite_recent on member.favorite(member_id,created_at desc,listing_id desc);
create index member_favorite_listing on member.favorite(listing_id,member_id);

alter table member.favorite enable row level security;

create policy appscope on member.favorite for all to shopapp
using(access.scope_allowed(member_id))
with check(access.scope_allowed(member_id));

create policy jobscope on member.favorite for all to shopjob
using(true)
with check(true);

grant select,insert,delete on member.favorite to shopapp,shopjob;

do $roles$
begin
  if exists(select 1 from pg_roles where rolname='zhudatuanwebapi') then
    execute 'grant select,insert,delete on member.favorite to zhudatuanwebapi';
  end if;
  if exists(select 1 from pg_roles where rolname='zhudatuanpurchaseapi') then
    execute 'grant select,insert,delete on member.favorite to zhudatuanpurchaseapi';
  end if;
end
$roles$;

do $assert$
begin
  if to_regclass('member.favorite') is null then raise exception 'MEMBER_FAVORITE_TABLE_MISSING'; end if;
  if exists(
    select 1 from pg_constraint
    where conrelid='member.favorite'::regclass and contype='f'
      and confrelid<> 'member.profile'::regclass
  ) then
    raise exception 'MEMBER_FAVORITE_CROSS_MODULE_FOREIGN_KEY';
  end if;
end
$assert$;

commit;
