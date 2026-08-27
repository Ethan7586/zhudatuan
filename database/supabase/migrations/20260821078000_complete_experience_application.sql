begin;

-- Application identity belongs to Experience. Keeping it in the canonical
-- aggregate prevents the Shop presentation adapter from inventing codes or
-- public slugs that do not exist in smart-wing.
alter table experience.application add column code text;
alter table experience.application add column public_slug text;
alter table experience.version add column reason text;

-- One-time hard cut from the retired Mall Application V1 document to the
-- canonical Experience V2 contract. Runtime code never carries a V1 parser.
with converted as(
  select version.id,jsonb_build_object(
    'version',2,
    'application',version.application_id,
    'pages',jsonb_build_array(jsonb_build_object(
      'id',version.application_id||':home',
      'path','home',
      'blocks',jsonb_build_array(
        jsonb_build_object('id',version.application_id||':home:identity','component','richtext','content',jsonb_build_object(
          'mallDisplayName',version.configuration->'mallDisplayName','themePreset',version.configuration->'themePreset',
          'memberCodeCta',version.configuration->'memberCodeCta')),
        jsonb_build_object('id',version.application_id||':home:hero','component','hero','content',version.configuration->'hero'),
        jsonb_build_object('id',version.application_id||':home:notice','component','notice','content',jsonb_build_object(
          'announcement',version.configuration->'announcement')),
        jsonb_build_object('id',version.application_id||':home:shortcut','component','shortcut','content',jsonb_build_object(
          'entries',version.configuration->'entries')),
        jsonb_build_object('id',version.application_id||':home:products','component','productcollection','content',jsonb_build_object(
          'partners',version.configuration->'partners','segments',version.configuration->'segments',
          'recommendationLimit',version.configuration->'recommendationLimit'))
      )
    ))
  ) document
  from experience.version version
  where version.schema_version='1' and version.configuration->>'schemaVersion'='1'
)
update experience.version version
set schema_version='2',configuration=converted.document,
  configuration_hash=encode(digest(converted.document::text,'sha256'),'hex'),validation_state='valid'
from converted where converted.id=version.id;

update experience.application
set code=left(case when upper(regexp_replace(regexp_replace(id,'^application:','','g'),'[^A-Za-z0-9]+','_','g'))~'^[A-Z]'
  then upper(regexp_replace(regexp_replace(id,'^application:','','g'),'[^A-Za-z0-9]+','_','g'))
  else 'APP_'||upper(regexp_replace(regexp_replace(id,'^application:','','g'),'[^A-Za-z0-9]+','_','g')) end,32),
  public_slug=left(trim(both '-' from lower(regexp_replace(regexp_replace(id,'^application:','','g'),'[^A-Za-z0-9]+','-','g'))),48);

alter table experience.application alter column code set not null;
alter table experience.application alter column public_slug set not null;
alter table experience.application add constraint experience_application_code_format check(code~'^[A-Z][A-Z0-9_]{2,31}$');
alter table experience.application add constraint experience_application_public_slug_format check(public_slug~'^[a-z0-9][a-z0-9-]{2,47}$');
alter table experience.application add constraint experience_application_scope_code_unique unique(scope_id,code);
alter table experience.application add constraint experience_application_scope_slug_unique unique(scope_id,public_slug);

-- A publishable application needs one canonical mall/pool binding. Derive it
-- only from active Catalog pool bindings; do not create a synthetic pool.
insert into experience.binding(application_id,domain,mall_id,pool_id)
select application.id,application.public_slug,binding.mall_id,binding.pool_id
from experience.application application
join lateral(
  select poolbinding.mall_id,poolbinding.pool_id from catalog.poolbinding poolbinding
  where poolbinding.mall_id=application.scope_id and poolbinding.status='active'
    and (poolbinding.effective_at is null or poolbinding.effective_at<=clock_timestamp())
    and (poolbinding.expires_at is null or poolbinding.expires_at>clock_timestamp())
  order by poolbinding.listing_kind,poolbinding.pool_id limit 1
) binding on true
where not exists(select 1 from experience.binding current where current.application_id=application.id)
on conflict do nothing;

with required_permission(code) as (values
  ('experience.application.manage'),
  ('experience.version.manage'),
  ('experience.version.publish')
), executable_permission as (
  select permission.id from required_permission required
  join access.permission permission on permission.code=required.code and permission.status='active'
)
delete from access.rolepermission mapping
using executable_permission permission
where mapping.role_id='role-platform-owner-v2'
  and mapping.permission_id=permission.id
  and mapping.effect='deny';

insert into access.rolepermission(role_id,permission_id,effect)
select 'role-platform-owner-v2',permission.id,'allow'
from access.permission permission
where permission.status='active'
  and permission.code in('experience.application.manage','experience.version.manage','experience.version.publish')
on conflict do nothing;

insert into runtime.schemaversion(version,checksum)
values('20260821078000','1ee9c7819b662818439020532e095f4fc2b2bf40bcf96c702c219ea802a6ff07');

do $assert$
declare
  required_operations constant text[] := array[
    'experience.applications.create',
    'experience.applications.copy',
    'experience.applications.update',
    'experience.versions.save',
    'experience.versions.validate',
    'experience.versions.publish',
    'experience.versions.restore'
  ];
begin
  if exists(select 1 from experience.application where code is null or public_slug is null) then
    raise exception 'EXPERIENCE_APPLICATION_IDENTITY_MISSING';
  end if;
  if exists(
    select 1 from unnest(required_operations) required(operation_id)
    where not exists(
      select 1 from capability.membership_operations('membership-platform-owner-ethan-v1') available
      where available.operation_id=required.operation_id
    )
  ) then
    raise exception 'PLATFORM_OWNER_EXPERIENCE_OPERATION_MISSING';
  end if;
end
$assert$;

commit;
