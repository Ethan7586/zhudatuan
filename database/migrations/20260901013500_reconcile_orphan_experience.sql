begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260901013000') then
    raise exception 'ORPHAN_EXPERIENCE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260901013500') then
    raise exception 'ORPHAN_EXPERIENCE_ALREADY_APPLIED';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260901014000') then
    raise exception 'ORPHAN_EXPERIENCE_TARGET_HEAD_ALREADY_APPLIED';
  end if;
  if exists(
    select 1 from experience.application application
    where not exists(select 1 from experience.binding binding where binding.application_id=application.id)
      and (application.status<>'draft' or exists(select 1 from experience.release release where release.application_id=application.id))
  ) then
    raise exception 'ORPHAN_EXPERIENCE_NON_DRAFT_REQUIRES_MANUAL_RECONCILIATION';
  end if;
  if exists(
    select 1
    from experience.application source
    where not exists(select 1 from experience.binding binding where binding.application_id=source.id)
      and 1<>(select count(distinct target.id)
        from organization.unitclosure hierarchy
        join experience.binding binding on binding.mall_id=hierarchy.descendant_id
        join experience.application target on target.id=binding.application_id and target.status='active'
        where hierarchy.ancestor_id=source.scope_id)
  ) then
    raise exception 'ORPHAN_EXPERIENCE_CANONICAL_TARGET_AMBIGUOUS';
  end if;
end
$precondition$;

create temporary table orphan_experience_application on commit drop as
select source.id source_application,min(target.id) target_application
from experience.application source
join organization.unitclosure hierarchy on hierarchy.ancestor_id=source.scope_id
join experience.binding binding on binding.mall_id=hierarchy.descendant_id
join experience.application target on target.id=binding.application_id and target.status='active'
where not exists(select 1 from experience.binding existing where existing.application_id=source.id)
group by source.id;

create temporary table orphan_experience_version on commit drop as
select version.id,source.source_application,source.target_application,
  coalesce((select max(existing.sequence) from experience.version existing where existing.application_id=source.target_application),0)
    +row_number() over(partition by source.target_application order by version.created_at,version.id) new_sequence,
  replace(version.configuration::text,source.source_application,source.target_application)::jsonb new_configuration
from orphan_experience_application source
join experience.version version on version.application_id=source.source_application;

create temporary table orphan_experience_evidence on commit drop as
select (select count(*) from orphan_experience_application) applications,
  (select count(*) from orphan_experience_version) versions;

update experience.application application set head_version_id=null,updated_at=clock_timestamp(),version=version+1
where application.id in(select source_application from orphan_experience_application) and application.head_version_id is not null;

update experience.version version
set application_id=source.target_application,
  sequence=source.new_sequence,
  configuration=source.new_configuration,
  configuration_hash=encode(public.digest(source.new_configuration::text,'sha256'),'hex'),
  reason=coalesce(version.reason,'orphaned acceptance draft reconciled')
from orphan_experience_version source where source.id=version.id;

delete from experience.application application
using orphan_experience_application source where application.id=source.source_application;

select runtime.record_migration_evidence('20260901013500',
  evidence.applications+evidence.versions,evidence.applications+evidence.versions,0,0,
  'select application_id,sequence,configuration_hash from experience.version order by application_id,sequence;',
  'select application.id,application.status,binding.mall_id,binding.pool_id from experience.application application left join experience.binding binding on binding.application_id=application.id order by application.id;')
from orphan_experience_evidence evidence;

insert into runtime.schemaversion(version,checksum)
values('20260901013500',encode(public.digest('20260901013500_reconcile_orphan_experience','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from experience.application application
    where not exists(select 1 from experience.binding binding where binding.application_id=application.id)) then
    raise exception 'ORPHAN_EXPERIENCE_REMAINS';
  end if;
  if exists(select 1 from orphan_experience_version source
    join experience.version version on version.id=source.id
    where version.application_id<>source.target_application
      or version.configuration->>'application'<>source.target_application
      or version.configuration_hash<>encode(public.digest(version.configuration::text,'sha256'),'hex')) then
    raise exception 'ORPHAN_EXPERIENCE_CONTENT_RECONCILIATION_INVALID';
  end if;
  if (select count(*) from orphan_experience_version)<>(select count(*) from experience.version version
    join orphan_experience_version source on source.id=version.id) then
    raise exception 'ORPHAN_EXPERIENCE_VERSION_LOST';
  end if;
end
$assert$;

commit;
