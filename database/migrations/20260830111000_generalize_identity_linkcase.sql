begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260830110000') then
    raise exception 'IDENTITY_LINKCASE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260830111000') then
    raise exception 'IDENTITY_LINKCASE_ALREADY_APPLIED';
  end if;
end $precondition$;

alter table identity.linkcase alter column provider_id drop not null;
alter table identity.linkcase alter column tenant_id drop not null;
alter table identity.linkcase add column organization_id text references organization.organization(id);
alter table identity.linkcase add column reference_id text;
alter table identity.linkcase add column source text not null default 'federation';
alter table identity.linkcase add constraint linkcase_source_valid check(source in('federation','enrollment'));
alter table identity.linkcase add constraint linkcase_source_shape_valid check(
  (source='federation' and provider_id is not null and tenant_id is not null and organization_id is null and reference_id is null)
  or (source='enrollment' and provider_id is null and transaction_id is null and tenant_id is null
    and organization_id is not null and reference_id is not null and reason='subjectconflict')
);
create unique index identity_linkcase_enrollment_open
on identity.linkcase(source,organization_id,reference_id,subject_hash) where source='enrollment' and status='open';
create index identity_linkcase_enrollment_scope on identity.linkcase(organization_id,created_at,id)
where source='enrollment' and status='open';

drop policy linkcaseapp on identity.linkcase;
drop policy linkcasepublic on identity.linkcase;
create policy linkcaseapp on identity.linkcase for all to shopapp using(
  source='federation' and tenant_id::text=nullif(current_setting('app.tenant_id',true),'')
  or source='enrollment' and access.scope_allowed(organization_id)
) with check(
  source='federation' and tenant_id::text=nullif(current_setting('app.tenant_id',true),'')
  or source='enrollment' and access.scope_allowed(organization_id)
);
create policy linkcasepublic on identity.linkcase for insert to shopapp with check(
  source='federation' and exists(select 1 from identity.provider provider
    where provider.id=provider_id and provider.tenant_id=tenant_id and provider.status='enabled')
  or source='enrollment' and current_setting('app.operation_id',true)='identity.enrollments.complete'
    and exists(select 1 from identity.invitationclaim claim join identity.invitation invitation on invitation.id=claim.invitation_id
      where claim.id::text=reference_id and invitation.organization_id=organization_id and claim.state in('reserved','proofpending','proved'))
);

select runtime.record_migration_evidence('20260830111000',
  (select count(*) from identity.linkcase),(select count(*) from identity.linkcase where source='federation'),0,0,
  'create index concurrently if not exists identity_linkcase_enrollment_scope_live on identity.linkcase(organization_id,created_at,id) where source=''enrollment'' and status=''open'';',
  'select source,status,count(*) from identity.linkcase group by source,status order by source,status;');
insert into runtime.schemaversion(version,checksum)
values('20260830111000',encode(public.digest('20260830111000_generalize_identity_linkcase','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from identity.linkcase where source='federation' and (provider_id is null or tenant_id is null)) then
    raise exception 'FEDERATION_LINKCASE_SHAPE_INVALID';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='identity' and indexname='identity_linkcase_enrollment_open') then
    raise exception 'ENROLLMENT_LINKCASE_INDEX_MISSING';
  end if;
end $assert$;

commit;
