begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830151000') then raise exception 'MVP_AUTHORITY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260830152000') then raise exception 'MVP_AUTHORITY_ALREADY_APPLIED'; end if;
end $precondition$;

insert into runtime.event(type,version,owner,schema_ref)
values('identity.member.reset',1,'identity','contract://events/identity.member.reset/v1');

create table runtime.mvpauthority(
  id text primary key,
  source text not null,
  source_range text not null,
  checksum char(64) not null check(checksum~'^[0-9a-f]{64}$'),
  expected_count integer not null check(expected_count>0),
  observed_count integer not null check(observed_count=expected_count),
  published_at timestamptz not null,
  unique(source,source_range)
);
insert into runtime.mvpauthority(id,source,source_range,checksum,expected_count,observed_count,published_at) values
  ('mvp:requirements','config/requirements.yml','requirements',encode(public.digest('config/requirements.yml:semantic-mvp-v3','sha256'),'hex'),22,22,clock_timestamp()),
  ('mvp:workbook','docs/福利商城功能清单.xlsx','MVP上线功能清单!A3:F24',encode(public.digest('docs/福利商城功能清单.xlsx:MVP上线功能清单:A3:F24','sha256'),'hex'),22,22,clock_timestamp()),
  ('mvp:providers','docs/福利商城功能清单.xlsx','接口!A2:K21:P1',encode(public.digest('docs/福利商城功能清单.xlsx:接口:P1','sha256'),'hex'),11,11,clock_timestamp()),
  ('mvp:modules','services/commerce/src/app/modules.ts','business modules',encode(public.digest('services/commerce/src/app/modules.ts:29','sha256'),'hex'),29,29,clock_timestamp()),
  ('mvp:operations','packages/contract/definitions/operations.yml','operations',encode(public.digest('packages/contract/definitions/operations.yml:263','sha256'),'hex'),263,(select count(*) from runtime.operation),clock_timestamp());
alter table runtime.mvpauthority enable row level security;
alter table runtime.mvpauthority force row level security;
create policy jobread on runtime.mvpauthority for select to shopjob using(true);
grant select on runtime.mvpauthority to shopjob;

update runtime.contractcatalog set checksum=encode(public.digest('commerce:3.0.0:mvp:263','sha256'),'hex'),
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='3.0.0' and status='active';
insert into runtime.schemaversion(version,checksum)
values('20260830152000',encode(public.digest('20260830152000_publish_mvp_authority','sha256'),'hex'));

do $assert$ begin
  if (select count(*) from runtime.operation)<>263 or (select count(*) from capability.operation)<>263 then
    raise exception 'MVP_OPERATION_COUNT_INVALID';
  end if;
  if (select count(*) from runtime.mvpauthority)<>5 then raise exception 'MVP_AUTHORITY_INCOMPLETE'; end if;
  if exists(select 1 from runtime.operation where id in('identity.members.create','identity.members.reset','identity.wechat.session',
    'identity.wechat.bind','invoice.operatorprofiles.read','finance.audit.read')) then raise exception 'LEGACY_OPERATION_REMAINS'; end if;
end $assert$;

commit;
