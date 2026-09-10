begin;
select pg_advisory_xact_lock(hashtext('member:storefront-custom-profile:v1'));
do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260909204000' and checksum='c2d12536aa4e832a343551634941cc008082d02e5e7a3fcd134201a81799c258')
    or exists(select 1 from runtime.schemaversion where version>'20260909204000') then raise exception 'STOREFRONT_MEMBER_CUSTOM_PROFILE_PREDECESSOR_INVALID'; end if;
end $precondition$;
create table member.storefrontcustomtag(
  organization_id text not null,id text not null,name text not null,color text not null check(color in('blue','purple','green','orange','pink','gray')),
  sort_order integer not null,enabled boolean not null,updated_at timestamptz not null,primary key(organization_id,id));
create table member.storefrontcustomfield(
  organization_id text not null,id text not null,name text not null,field_type text not null check(field_type in('text','number','date','select','multiselect','switch','remark')),
  options jsonb not null,sort_order integer not null,enabled boolean not null,updated_at timestamptz not null,primary key(organization_id,id));
create table member.storefrontmembertag(
  organization_id text not null,membership_id text not null references access.membership(id) on delete cascade,tag_id text not null,
  primary key(organization_id,membership_id,tag_id),foreign key(organization_id,tag_id) references member.storefrontcustomtag(organization_id,id) on delete cascade);
create table member.storefrontmemberfieldvalue(
  organization_id text not null,membership_id text not null references access.membership(id) on delete cascade,field_id text not null,value jsonb not null,updated_at timestamptz not null,
  primary key(organization_id,membership_id,field_id),foreign key(organization_id,field_id) references member.storefrontcustomfield(organization_id,id) on delete cascade);
alter table member.storefrontcustomtag enable row level security;
alter table member.storefrontcustomfield enable row level security;
alter table member.storefrontmembertag enable row level security;
alter table member.storefrontmemberfieldvalue enable row level security;
create policy appscope on member.storefrontcustomtag for all to shopapp using(organization_id=nullif(current_setting('app.scope_id',true),'')) with check(organization_id=nullif(current_setting('app.scope_id',true),''));
create policy appscope on member.storefrontcustomfield for all to shopapp using(organization_id=nullif(current_setting('app.scope_id',true),'')) with check(organization_id=nullif(current_setting('app.scope_id',true),''));
create policy appscope on member.storefrontmembertag for all to shopapp using(organization_id=nullif(current_setting('app.scope_id',true),'')) with check(organization_id=nullif(current_setting('app.scope_id',true),''));
create policy appscope on member.storefrontmemberfieldvalue for all to shopapp using(organization_id=nullif(current_setting('app.scope_id',true),'')) with check(organization_id=nullif(current_setting('app.scope_id',true),''));
grant select,insert,update,delete on member.storefrontcustomtag,member.storefrontcustomfield,member.storefrontmembertag,member.storefrontmemberfieldvalue to shopapp;
insert into runtime.operation(id,owner,method,path,contract_version) values
 ('member.storefront.detail.read','member','GET','/api/v1/member/storefront-members/{membershipid}','1.0.0'),
 ('member.storefront.invitees.read','member','GET','/api/v1/member/storefront-members/{membershipid}/invitees','1.0.0'),
 ('member.storefront.orders.read','member','GET','/api/v1/member/storefront-members/{membershipid}/orders','1.0.0'),
 ('member.storefront.config.read','member','GET','/api/v1/member/storefront-profile-config','1.0.0'),
 ('member.storefront.config.manage','member','PUT','/api/v1/member/storefront-profile-config','1.0.0'),
 ('member.storefront.custom.read','member','GET','/api/v1/member/storefront-members/{membershipid}/custom-profile','1.0.0'),
 ('member.storefront.custom.manage','member','PUT','/api/v1/member/storefront-members/{membershipid}/custom-profile','1.0.0');
insert into capability.capability(id,kind,name,version,status) values
 ('member.storefront.detail.read','operation','member.storefront.detail.read',1,'active'),
 ('member.storefront.invitees.read','operation','member.storefront.invitees.read',1,'active'),
 ('member.storefront.orders.read','operation','member.storefront.orders.read',1,'active'),
 ('member.storefront.config.read','operation','member.storefront.config.read',1,'active'),('member.storefront.config.manage','operation','member.storefront.config.manage',1,'active'),
 ('member.storefront.custom.read','operation','member.storefront.custom.read',1,'active'),('member.storefront.custom.manage','operation','member.storefront.custom.manage',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience) values
 ('member.storefront.detail.read','member.storefront.detail.read','member.read','operator'),
 ('member.storefront.invitees.read','member.storefront.invitees.read','member.read','operator'),
 ('member.storefront.orders.read','member.storefront.orders.read','member.read','operator'),
 ('member.storefront.config.read','member.storefront.config.read','member.read','operator'),('member.storefront.config.manage','member.storefront.config.manage','member.read','operator'),
 ('member.storefront.custom.read','member.storefront.custom.read','member.read','operator'),('member.storefront.custom.manage','member.storefront.custom.manage','member.read','operator');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version)
select 'platform:'||id,'organization-platform-root',id,'enabled',null,'1970-01-01T00:00:00Z',null,0 from capability.capability
where id in('member.storefront.detail.read','member.storefront.invitees.read','member.storefront.orders.read',
  'member.storefront.config.read','member.storefront.config.manage','member.storefront.custom.read','member.storefront.custom.manage');
insert into runtime.schemaversion(version,checksum) values('20260911010000','33504f898d2ba5f955ffd8c87584f57fa18d6d7290c567639049fc4f24f2a350');
do $assert$ begin
  if to_regclass('member.storefrontcustomtag') is null or to_regclass('member.storefrontcustomfield') is null
    or to_regclass('member.storefrontmembertag') is null or to_regclass('member.storefrontmemberfieldvalue') is null
    or (select count(*) from runtime.operation where id in('member.storefront.detail.read','member.storefront.invitees.read','member.storefront.orders.read',
      'member.storefront.config.read','member.storefront.config.manage','member.storefront.custom.read','member.storefront.custom.manage'))<>7
    or not exists(select 1 from runtime.schemaversion where version='20260911010000' and checksum='33504f898d2ba5f955ffd8c87584f57fa18d6d7290c567639049fc4f24f2a350')
    then raise exception 'STOREFRONT_MEMBER_CUSTOM_PROFILE_INCOMPLETE'; end if;
end $assert$;
commit;
