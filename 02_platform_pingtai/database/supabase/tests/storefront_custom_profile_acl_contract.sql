create extension if not exists pgcrypto;
create role zhudatuanidentityapi;
create schema member;
create schema runtime;
create table runtime.schemaversion(version text primary key,checksum text not null);

create table member.storefrontcustomtag(organization_id text,id text,name text);
create table member.storefrontcustomfield(organization_id text,id text,name text);
create table member.storefrontmembertag(organization_id text,membership_id text,tag_id text);
create table member.storefrontmemberfieldvalue(organization_id text,membership_id text,field_id text,value jsonb);

do $setup$
declare relation_name text;
begin
  foreach relation_name in array array[
    'storefrontcustomtag','storefrontcustomfield',
    'storefrontmembertag','storefrontmemberfieldvalue'
  ] loop
    execute format('alter table member.%I enable row level security',relation_name);
  end loop;
end
$setup$;

\ir ../migrations/20260917110000_restore_storefront_custom_profile_acl.sql

set role zhudatuanidentityapi;
set app.scope_id='mall:a';
insert into member.storefrontcustomtag values('mall:a','tag:a','A');
insert into member.storefrontcustomfield values('mall:a','field:a','A');
insert into member.storefrontmembertag values('mall:a','membership:a','tag:a');
insert into member.storefrontmemberfieldvalue values('mall:a','membership:a','field:a','"A"');
update member.storefrontcustomtag set name='A updated' where organization_id='mall:a';
update member.storefrontcustomfield set name='A updated' where organization_id='mall:a';
do $test$
begin
  if (select count(*) from member.storefrontcustomtag where name='A updated')<>1
    or (select count(*) from member.storefrontcustomfield where name='A updated')<>1
    or (select count(*) from member.storefrontmembertag)<>1
    or (select count(*) from member.storefrontmemberfieldvalue)<>1 then
    raise exception 'CUSTOM_PROFILE_SCOPE_A_READ_INVALID';
  end if;
  begin
    insert into member.storefrontcustomtag values('mall:b','tag:b','B');
    raise exception 'CUSTOM_PROFILE_CROSS_SCOPE_WRITE_ALLOWED';
  exception when insufficient_privilege then null;
  end;
end
$test$;

set app.scope_id='mall:b';
insert into member.storefrontcustomtag values('mall:b','tag:b','B');
insert into member.storefrontcustomfield values('mall:b','field:b','B');
insert into member.storefrontmembertag values('mall:b','membership:b','tag:b');
insert into member.storefrontmemberfieldvalue values('mall:b','membership:b','field:b','"B"');
do $test$
begin
  if (select count(*) from member.storefrontcustomtag)<>1
    or (select count(*) from member.storefrontcustomfield)<>1
    or (select count(*) from member.storefrontmembertag)<>1
    or (select count(*) from member.storefrontmemberfieldvalue)<>1 then
    raise exception 'CUSTOM_PROFILE_SCOPE_B_READ_INVALID';
  end if;
end
$test$;

delete from member.storefrontmemberfieldvalue where organization_id='mall:a';
delete from member.storefrontmembertag where organization_id='mall:a';
set app.scope_id='mall:a';
do $test$
begin
  if (select count(*) from member.storefrontmemberfieldvalue)<>1
    or (select count(*) from member.storefrontmembertag)<>1 then
    raise exception 'CUSTOM_PROFILE_CROSS_SCOPE_DELETE_ALLOWED';
  end if;
end
$test$;

reset app.scope_id;
do $test$
begin
  if (select count(*) from member.storefrontcustomtag)<>0
    or (select count(*) from member.storefrontcustomfield)<>0
    or (select count(*) from member.storefrontmembertag)<>0
    or (select count(*) from member.storefrontmemberfieldvalue)<>0 then
    raise exception 'CUSTOM_PROFILE_READ_WITHOUT_SCOPE';
  end if;
end
$test$;
