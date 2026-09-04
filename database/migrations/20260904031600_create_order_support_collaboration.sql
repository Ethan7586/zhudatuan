begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904031500') then raise exception 'ORDER_SUPPORT_COLLABORATION_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904031600') then raise exception 'ORDER_SUPPORT_COLLABORATION_ALREADY_APPLIED'; end if;
end
$precondition$;

create unique index ordering_aftersale_order_identity on ordering.aftersale(id,order_id);

create table ordering.supportcollaboration(
  id text primary key check(id~'^supportcollaboration:'),
  order_id text not null references ordering.orderrecord(id),
  aftersale_id text,
  support_case_id text not null,
  scope_id text not null,
  member_id text not null,
  kind text not null check(kind in('caseopened')),
  actor_id text not null,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  created_at timestamptz not null,
  unique(support_case_id),
  check(aftersale_id is null or kind='caseopened')
);
alter table ordering.supportcollaboration add constraint ordering_supportcollaboration_aftersale
foreign key(aftersale_id,order_id) references ordering.aftersale(id,order_id);
create index ordering_supportcollaboration_order on ordering.supportcollaboration(order_id,created_at,id);
create index ordering_supportcollaboration_aftersale on ordering.supportcollaboration(aftersale_id,created_at,id) where aftersale_id is not null;

create function ordering.reject_support_collaboration_mutation() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $function$ begin raise exception 'ORDER_SUPPORT_COLLABORATION_IMMUTABLE'; end $function$;
revoke all on function ordering.reject_support_collaboration_mutation() from public,shopapp,shopjob;
create trigger ordering_supportcollaboration_immutable before update or delete on ordering.supportcollaboration
for each row execute function ordering.reject_support_collaboration_mutation();

alter table ordering.supportcollaboration enable row level security;
alter table ordering.supportcollaboration force row level security;
create policy supportcollaborationapp on ordering.supportcollaboration for select to shopapp using(access.scope_allowed(scope_id));
create policy supportcollaborationinsert on ordering.supportcollaboration for insert to shopapp with check(access.scope_allowed(scope_id));
create policy supportcollaborationjob on ordering.supportcollaboration for all to shopjob using(true) with check(true);
revoke all on ordering.supportcollaboration from public;
grant select,insert on ordering.supportcollaboration to shopapp,shopjob;

select runtime.record_migration_evidence(
  '20260904031600',0,0,0,0,
  'select order_id,aftersale_id,support_case_id,kind,created_at from ordering.supportcollaboration order by created_at,id;',
  'select schemaname,tablename,policyname,cmd from pg_policies where schemaname=''ordering'' and tablename=''supportcollaboration'' order by policyname;'
);

insert into runtime.schemaversion(version,checksum)
values('20260904031600',encode(public.digest('20260904031600_create_order_support_collaboration','sha256'),'hex'));

do $assert$
begin
  if not exists(select 1 from pg_class where oid='ordering.supportcollaboration'::regclass and relrowsecurity and relforcerowsecurity) then raise exception 'ORDER_SUPPORT_COLLABORATION_RLS_MISSING'; end if;
  if (select count(*) from pg_trigger where tgrelid='ordering.supportcollaboration'::regclass and tgname='ordering_supportcollaboration_immutable' and not tgisinternal)<>1 then raise exception 'ORDER_SUPPORT_COLLABORATION_IMMUTABILITY_MISSING'; end if;
end
$assert$;

commit;
